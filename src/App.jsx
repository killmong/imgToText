import { useState, useEffect } from "react";
import Tesseract from "tesseract.js";
import { Document, Packer, Paragraph } from "docx";
import { saveAs } from "file-saver";
import { FaGithub } from "react-icons/fa";
import "./App.css";

function App() {
  const [img, setImg] = useState("");
  const [text, setText] = useState(localStorage.getItem("text") || "");
  const [isExtracted, setIsExtracted] = useState(false);

  useEffect(() => {
    const storedText = localStorage.getItem("text");

    if (storedText) setText(storedText);
  }, []);

  const handleChange = (e) => {
    localStorage.removeItem("text");

    const newImg = URL.createObjectURL(e.target.files[0]);

    setImg(newImg);
    setIsExtracted(false);
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

  const handleDelete = () => {
    setText("");
    setIsExtracted(false);

    localStorage.removeItem("text");
  };

  const handleClick = () => {
    Tesseract.recognize(img, "eng", {
      logger: (m) => console.log(m),
    })
      .catch((err) => console.error(err))
      .then((result) => {
        const extractedText = result.data.text;

        setText(extractedText);
        setIsExtracted(true);

        localStorage.setItem("text", extractedText); // Store extracted text
      });
  };

  return (
    <div className="App">
      <a href="https://github.com/killmong/imgToText">
        <FaGithub className="github-icon" />
      </a>
      <main className="App-main">
        <h3>Upload the Image</h3>
        <div>
          <label htmlFor="img">Select the Image</label>
          <input type="file" id="img" onChange={handleChange} />
          {img && <img src={img} className="App-logo" alt="logo" />}
        </div>
        <button className="success" onClick={handleClick}>
          Extract text
        </button>

        <h3>Extracted text</h3>
      </main>
      <div className="text-box">
        {isExtracted == true && (
          <div className="dog-container">
            <img
              className="dog-animation"
              src="freepik__background__73602.png"
              alt="Dog Animation"
            />
          </div>
        )}
        <p>{text}</p>

        {text && (
          <button className="success" onClick={saveAsWordFile}>
            Save as Word file
          </button>
        )}
        {text && (
          <button className="delete" onClick={handleDelete}>
            Delete!
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
