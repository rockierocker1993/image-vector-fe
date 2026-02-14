import './ResultViewer.css'

export function ResultViewer() {
  return (
    <div className="result-viewer">
      <h2 className="result-title">Vectorizer.AI Result</h2>

      <div className="result-canvas">
        <div className="checkerboard">
          <div className="image-container">
            <img
              src="https://cdn-icons-png.flaticon.com/512/616/616554.png"
              alt="Vectorized result"
              className="result-image"
              draggable={false}
            />
          </div>
        </div>
      </div>

      <p className="result-info">test.png (655 x 727 px)</p>
    </div>
  )
}
