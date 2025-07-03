import { useState } from "react";
import { jsPDF } from "jspdf";

export default function FormularioEntrega() {
  const [form, setForm] = useState({
    cliente: "",
    numeroServico: "",
    servicoEfetuado: "",
    dataEntrega: "",
    observacoes: "",
  });

  const atualizarCampo = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const gerarPDF = () => {
    const doc = new jsPDF();

    doc.setFont("helvetica", "");
    doc.setFontSize(12);
    doc.text("Luthier & Serviços", 10, 15);
    doc.text("Rua dos Instrumentos, 123", 10, 22);
    doc.text("Lisboa, Portugal", 10, 28);
    doc.text("Telefone: 912 345 678", 10, 34);
    doc.text("Email: contacto@luthier.pt", 10, 40);

    doc.setFontSize(14);
    doc.text("Ficha de Entrega de Instrumento", 10, 60);

    let y = 70;
    Object.entries(form).forEach(([campo, valor]) => {
      const nomeCampo = campo.replace(/([A-Z])/g, " $1");
      const texto = `${nomeCampo.charAt(0).toUpperCase() + nomeCampo.slice(1)}: ${valor}`;
      const linhas = doc.splitTextToSize(texto, 180);
      linhas.forEach((linha, i) => {
        doc.text(linha, 10, y + i * 10);
      });
      y += linhas.length * 10;
    });

    doc.save(`entrega_${form.cliente.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "auto", padding: "20px", color: "white" }}>
      <h1>Entrega de Instrumento</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          gerarPDF();
        }}
      >
        {[
          { name: "cliente", label: "Cliente" },
          { name: "numeroServico", label: "Número de Serviço" },
          { name: "servicoEfetuado", label: "Serviço Efetuado", isTextarea: true },
          { name: "dataEntrega", label: "Data de Entrega", type: "date" },
          { name: "observacoes", label: "Observações", isTextarea: true },
        ].map(({ name, label, type, isTextarea }) => (
          <div key={name} style={{ marginBottom: "10px" }}>
            <label>{label}:</label>
            {isTextarea ? (
              <textarea
                name={name}
                value={form[name]}
                onChange={atualizarCampo}
                rows="3"
                style={{ width: "100%", backgroundColor: "#222", color: "white", border: "1px solid #555", borderRadius: "4px", padding: "8px" }}
              />
            ) : (
              <input
                type={type || "text"}
                name={name}
                value={form[name]}
                onChange={atualizarCampo}
                style={{ width: "100%", backgroundColor: "#222", color: "white", border: "1px solid #555", borderRadius: "4px", padding: "8px" }}
              />
            )}
          </div>
        ))}
        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>Gerar PDF</button>
      </form>
    </div>
  );
}
