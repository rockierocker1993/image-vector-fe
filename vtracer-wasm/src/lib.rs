use wasm_bindgen::prelude::*;
use vtracer::{Config, ColorMode, Hierarchical, ColorImage, SvgFile};
use visioncortex::PathSimplifyMode;
use visioncortex::color_clusters::{KeyingAction, Runner, RunnerConfig, HIERARCHICAL_MAX};
use visioncortex::{Color, ColorName};

/// Batas minimal rasio pixel transparan terhadap total pixel yang di-sampling
/// agar proses keying diaktifkan (20%)
const KEYING_THRESHOLD: f32 = 0.2;

/// Mengkonversi sudut dari derajat ke radian
fn deg2rad(deg: i32) -> f64 {
    deg as f64 / 180.0 * std::f64::consts::PI
}

/// Memanggil callback JavaScript untuk melaporkan progress dalam persen (0-100).
/// Jika callback tidak diberikan (None), tidak melakukan apa-apa.
fn report_progress(callback: &Option<js_sys::Function>, percent: f64) {
    if let Some(cb) = callback {
        let _ = cb.call1(&JsValue::NULL, &JsValue::from_f64(percent));
    }
}

/// Mengecek apakah gambar memiliki cukup banyak pixel transparan sehingga perlu
/// dilakukan "keying" (penggantian pixel transparan dengan warna unik).
/// Sampling dilakukan pada 5 baris horizontal (atas, 1/4, 1/2, 3/4, bawah)
/// untuk efisiensi. Mengembalikan true jika jumlah pixel transparan >= 20% dari
/// 2x lebar gambar.
fn should_key_image(img: &ColorImage) -> bool {
    if img.width == 0 || img.height == 0 {
        return false;
    }
    let threshold = ((img.width * 2) as f32 * KEYING_THRESHOLD) as usize;
    let mut num_transparent_pixels = 0;
    let y_positions = [
        0,
        img.height / 4,
        img.height / 2,
        3 * img.height / 4,
        img.height - 1,
    ];
    for y in y_positions {
        for x in 0..img.width {
            if img.get_pixel(x, y).a == 0 {
                num_transparent_pixels += 1;
            }
            if num_transparent_pixels >= threshold {
                return true;
            }
        }
    }
    false
}

/// Mengecek apakah suatu warna RGB sudah dipakai di dalam gambar.
/// Melakukan pengecekan pixel per pixel. Digunakan oleh `find_unused_color_in_image`
/// untuk memastikan key color yang dipilih tidak bentrok dengan warna yang ada.
fn color_exists_in_image(img: &ColorImage, color: Color) -> bool {
    for y in 0..img.height {
        for x in 0..img.width {
            let pixel_color = img.get_pixel(x, y);
            if pixel_color.r == color.r && pixel_color.g == color.g && pixel_color.b == color.b {
                return true;
            }
        }
    }
    false
}

/// Mencari warna yang tidak terpakai di dalam gambar dari 12 kandidat warna.
/// Warna ini akan digunakan sebagai "key color" untuk menggantikan pixel transparan.
/// Jika semua kandidat sudah terpakai, mengembalikan error.
fn find_unused_color_in_image(img: &ColorImage) -> Result<Color, String> {
    let candidates = [
        Color::new(255, 0, 0),
        Color::new(0, 255, 0),
        Color::new(0, 0, 255),
        Color::new(255, 255, 0),
        Color::new(0, 255, 255),
        Color::new(255, 0, 255),
        Color::new(1, 1, 1),
        Color::new(2, 2, 2),
        Color::new(254, 254, 254),
        Color::new(128, 0, 128),
        Color::new(0, 128, 128),
        Color::new(128, 128, 0),
    ];
    for color in candidates {
        if !color_exists_in_image(img, color) {
            return Ok(color);
        }
    }
    Err(String::from("unable to find unused color in image to use as key"))
}

/// Mengkonversi gambar berwarna (color mode) menjadi SVG dengan pelaporan progress.
///
/// Tahapan:
/// 1. Keying (10-15%) - Mengganti pixel transparan dengan key color
/// 2. Clustering (15-50%) - Mengelompokkan pixel berwarna mirip menjadi cluster
/// 3. Re-clustering cutout (50-55%) - Opsional, hanya jika hierarchical = "cutout"
/// 4. Konversi path (55-95%) - Mengubah setiap cluster menjadi path SVG
fn convert_color_with_progress(
    mut img: ColorImage,
    config: &Config,
    progress: &Option<js_sys::Function>,
) -> Result<SvgFile, String> {
    let width = img.width;
    let height = img.height;

    let filter_speckle_area = config.filter_speckle * config.filter_speckle;
    let color_precision_loss = 8 - config.color_precision;
    let corner_threshold = deg2rad(config.corner_threshold);
    let splice_threshold = deg2rad(config.splice_threshold);

    // Keying phase (~10-15%)
    let key_color = if should_key_image(&img) {
        let key_color = find_unused_color_in_image(&img)?;
        for y in 0..height {
            for x in 0..width {
                if img.get_pixel(x, y).a == 0 {
                    img.set_pixel(x, y, &key_color);
                }
            }
        }
        key_color
    } else {
        Color::default()
    };

    report_progress(progress, 15.0);

    // Clustering phase (~15-50%)
    let runner = Runner::new(
        RunnerConfig {
            diagonal: config.layer_difference == 0,
            hierarchical: HIERARCHICAL_MAX,
            batch_size: 25600,
            good_min_area: filter_speckle_area,
            good_max_area: width * height,
            is_same_color_a: color_precision_loss,
            is_same_color_b: 1,
            deepen_diff: config.layer_difference,
            hollow_neighbours: 1,
            key_color,
            keying_action: if matches!(config.hierarchical, Hierarchical::Cutout) {
                KeyingAction::Keep
            } else {
                KeyingAction::Discard
            },
        },
        img,
    );

    let mut clusters = runner.run();

    report_progress(progress, 50.0);

    // Optional cutout re-clustering (~50-55%)
    match config.hierarchical {
        Hierarchical::Stacked => {}
        Hierarchical::Cutout => {
            let view = clusters.view();
            let image = view.to_color_image();
            let runner = Runner::new(
                RunnerConfig {
                    diagonal: false,
                    hierarchical: 64,
                    batch_size: 25600,
                    good_min_area: 0,
                    good_max_area: (image.width * image.height) as usize,
                    is_same_color_a: 0,
                    is_same_color_b: 1,
                    deepen_diff: 0,
                    hollow_neighbours: 0,
                    key_color,
                    keying_action: KeyingAction::Discard,
                },
                image,
            );
            clusters = runner.run();
        }
    }

    report_progress(progress, 55.0);

    // Path conversion phase (~55-95%) - granular progress per cluster
    let view = clusters.view();
    let total_clusters = view.clusters_output.len();
    let mut svg = SvgFile::new(width, height, config.path_precision);

    for (i, &cluster_index) in view.clusters_output.iter().rev().enumerate() {
        let cluster = view.get_cluster(cluster_index);
        let paths = cluster.to_compound_path(
            &view,
            false,
            config.mode,
            corner_threshold,
            config.length_threshold,
            config.max_iterations,
            splice_threshold,
        );
        svg.add_path(paths, cluster.residue_color());

        if total_clusters > 0 {
            let pct = 55.0 + (i as f64 + 1.0) / total_clusters as f64 * 40.0;
            report_progress(progress, pct);
        }
    }

    Ok(svg)
}

/// Mengkonversi gambar hitam-putih (binary mode) menjadi SVG dengan pelaporan progress.
///
/// Tahapan:
/// 1. Konversi ke binary (->15%) - Pixel dengan R < 128 dianggap hitam
/// 2. Deteksi cluster (15-40%) - Mengelompokkan area hitam yang berdekatan
/// 3. Konversi path (40-95%) - Mengubah setiap cluster menjadi path SVG,
///    hanya cluster yang ukurannya >= filter_speckle² yang diproses
fn convert_binary_with_progress(
    img: ColorImage,
    config: &Config,
    progress: &Option<js_sys::Function>,
) -> Result<SvgFile, String> {
    let filter_speckle_area = config.filter_speckle * config.filter_speckle;
    let corner_threshold = deg2rad(config.corner_threshold);
    let splice_threshold = deg2rad(config.splice_threshold);

    let img = img.to_binary_image(|x| x.r < 128);
    let width = img.width;
    let height = img.height;

    report_progress(progress, 15.0);

    let clusters = img.to_clusters(false);

    report_progress(progress, 40.0);

    let total = clusters.len();
    let mut svg = SvgFile::new(width, height, config.path_precision);

    for i in 0..total {
        let cluster = clusters.get_cluster(i);
        if cluster.size() >= filter_speckle_area {
            let paths = cluster.to_compound_path(
                config.mode,
                corner_threshold,
                config.length_threshold,
                config.max_iterations,
                splice_threshold,
            );
            svg.add_path(paths, Color::color(&ColorName::Black));
        }

        if total > 0 {
            let pct = 40.0 + (i as f64 + 1.0) / total as f64 * 55.0;
            report_progress(progress, pct);
        }
    }

    Ok(svg)
}

/// Fungsi utama yang di-export ke JavaScript melalui WebAssembly.
/// Menerima raw bytes gambar (PNG/JPG/BMP/dll) dan mengkonversinya menjadi string SVG.
///
/// Semua parameter kecuali `data` bersifat opsional (pass null/undefined untuk default).
///
/// Parameter:
/// - `data`: Raw bytes file gambar (Uint8Array di JS)
/// - `colormode`: "color" (default) atau "bw" untuk hitam-putih
/// - `filter_speckle`: Ukuran minimum patch dalam pixel (default: 4)
/// - `color_precision`: Bit signifikan per channel RGB, 1-8 (default: 6)
/// - `gradient_step`: Perbedaan warna antar layer gradient (default: 16)
/// - `corner_threshold`: Sudut minimum (derajat) untuk dianggap sudut (default: 60)
/// - `segment_length`: Panjang maksimum segmen sebelum subdivisi (default: 4.0)
/// - `splice_threshold`: Sudut minimum (derajat) untuk splice spline (default: 45)
/// - `mode`: Metode fitting kurva - "pixel", "polygon", atau "spline" (default: "spline")
/// - `hierarchical`: Metode clustering - "stacked" (default) atau "cutout"
/// - `path_precision`: Jumlah desimal di koordinat path SVG (default: 2)
/// - `preset`: Konfigurasi preset - "bw", "poster", atau "photo" (override default)
/// - `progress`: Callback JavaScript (persen: number) => void untuk progress 0-100
#[wasm_bindgen]
pub fn trace_image(
    data: &[u8],
    colormode: Option<String>,
    filter_speckle: Option<usize>,
    color_precision: Option<i32>,
    gradient_step: Option<i32>,
    corner_threshold: Option<i32>,
    segment_length: Option<f64>,
    splice_threshold: Option<i32>,
    mode: Option<String>,
    hierarchical: Option<String>,
    path_precision: Option<u32>,
    preset: Option<String>,
    progress: Option<js_sys::Function>,
) -> Result<String, JsValue> {

    report_progress(&progress, 0.0);

    let img = image::load_from_memory(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?;
    let img = img.to_rgba8();
    let (width, height) = (img.width() as usize, img.height() as usize);

    let color_image = ColorImage {
        pixels: img.as_raw().to_vec(),
        width,
        height,
    };

    report_progress(&progress, 5.0);

    let mut config = if let Some(ref p) = preset {
        match p.as_str() {
            "bw" => Config::from_preset(vtracer::Preset::Bw),
            "poster" => Config::from_preset(vtracer::Preset::Poster),
            "photo" => Config::from_preset(vtracer::Preset::Photo),
            _ => return Err(JsValue::from_str(&format!("Unknown preset: '{}'. Use 'bw', 'poster', or 'photo'.", p))),
        }
    } else {
        Config::default()
    };

    if let Some(cm) = colormode {
        config.color_mode = match cm.as_str() {
            "color" => ColorMode::Color,
            "bw" | "binary" => ColorMode::Binary,
            _ => return Err(JsValue::from_str(&format!("Unknown colormode: '{}'. Use 'color' or 'bw'.", cm))),
        };
    }
    if let Some(v) = filter_speckle {
        config.filter_speckle = v;
    }
    if let Some(v) = color_precision {
        config.color_precision = v;
    }
    if let Some(v) = gradient_step {
        config.layer_difference = v;
    }
    if let Some(v) = corner_threshold {
        config.corner_threshold = v;
    }
    if let Some(v) = segment_length {
        config.length_threshold = v;
    }
    if let Some(v) = splice_threshold {
        config.splice_threshold = v;
    }
    if let Some(m) = mode {
        config.mode = match m.as_str() {
            "pixel" | "none" => PathSimplifyMode::None,
            "polygon" => PathSimplifyMode::Polygon,
            "spline" => PathSimplifyMode::Spline,
            _ => return Err(JsValue::from_str(&format!("Unknown mode: '{}'. Use 'pixel', 'polygon', or 'spline'.", m))),
        };
    }
    if let Some(h) = hierarchical {
        config.hierarchical = match h.as_str() {
            "stacked" => Hierarchical::Stacked,
            "cutout" => Hierarchical::Cutout,
            _ => return Err(JsValue::from_str(&format!("Unknown hierarchical: '{}'. Use 'stacked' or 'cutout'.", h))),
        };
    }
    if let Some(v) = path_precision {
        config.path_precision = Some(v);
    }

    report_progress(&progress, 10.0);

    let svg = match config.color_mode {
        ColorMode::Color => convert_color_with_progress(color_image, &config, &progress),
        ColorMode::Binary => convert_binary_with_progress(color_image, &config, &progress),
    }.map_err(|e| JsValue::from_str(&e))?;

    report_progress(&progress, 95.0);

    let result = svg.to_string();

    report_progress(&progress, 100.0);

    Ok(result)
}
