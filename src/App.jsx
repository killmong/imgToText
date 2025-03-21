import { useState } from "react";
import Tesseract from "tesseract.js";
import { Document, Packer, Paragraph } from "docx";
import { saveAs } from "file-saver";
import "./App.css";

function App() {
  const [img, setImg] = useState("");
  const [text, setText] = useState("");

  const handleChange = (e) => {
    setImg(URL.createObjectURL(e.target.files[0]));
  };

  const saveAsWordFile = () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [new Paragraph(text)],
        },
      ],
    });

    // Create a Word file and trigger download
    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, "extracted-text.docx");
    });
  };

  const handleClick = () => {
    Tesseract.recognize(img, "eng", {
      logger: (m) => console.log(m),
    })
      .catch((err) => console.error(err))
      .then((result) => {
        setText(result.data.text);
      });
  };

  return (
    <div className="App">
      <main className="App-main">
        <h3>Upload the Image</h3>
        <div>
          <label htmlFor="img">Select the Image</label>
          <input type="file" id="img" onChange={handleChange} />
          {img && <img src={img} className="App-logo" alt="logo" />}
        </div>
        <button onClick={handleClick}>Extract text</button>

        <h3>Extracted text</h3>
      </main>
      <div className="text-box">
        <p> {text} </p>

        {text && <button onClick={saveAsWordFile}>Save as Word file</button>}
      </div>{" "}
    </div>
  );
}

export default App;
