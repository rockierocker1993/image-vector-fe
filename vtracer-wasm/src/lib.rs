use wasm_bindgen::prelude::*;
use vtracer::{Config, ColorMode, Hierarchical, ColorImage, convert};
use visioncortex::PathSimplifyMode;

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
) -> Result<String, JsValue> {

    let img = image::load_from_memory(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to decode image: {}", e)))?;
    let img = img.to_rgba8();
    let (width, height) = (img.width() as usize, img.height() as usize);

    let color_image = ColorImage {
        pixels: img.as_raw().to_vec(),
        width,
        height,
    };

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

    let svg = convert(color_image, config)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(svg.to_string())
}
