import React, { useState } from "react";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getApp } from "firebase/app";

export default function UploadLogoBase64() {
  const [base64, setBase64] = useState("");
  const [status, setStatus] = useState("");
  const db = getFirestore(getApp());

  // Função para converter arquivo em base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64String = await fileToBase64(file);
      setBase64(base64String);
    } catch (err) {
      console.error("Erro ao converter imagem:", err);
      setStatus("Erro ao converter imagem");
    }
  }

  async function handleUpload() {
    if (!base64) {
      setStatus("Nenhuma imagem selecionada");
      return;
    }
    setStatus("A enviar...");
    try {
      const docRef = doc(db, "companySettings", "config");
      await setDoc(
        docRef,
        {
          logoBase64: base64,
        },
        { merge: true }
      );
      setStatus("Upload efetuado com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar no Firestore:", err);
      setStatus("Erro ao salvar no Firestore");
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "auto" }}>
      <h2>Upload do Logo (base64)</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {base64 && (
        <div>
          <p>Pré-visualização:</p>
          <img src={base64} alt="Pré-visualização do logo" style={{ maxWidth: "100%" }} />
        </div>
      )}
      <button onClick={handleUpload} style={{ marginTop: 10 }}>
        Enviar para Firestore
      </button>
      <p>{status}</p>
    </div>
  );
}
