import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuth } from "./AuthProvider";

export default function CompanySettings({ onComplete }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nomeEmpresa: "",
    morada: "",
    codigoPostal: "",
    localidade: "",
    contacto: "",
    email: "",
    nif: "",
    logoBase64: "",
    mensagemWhatsapp: "",
    enviarMensagemWhatsapp: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const docRef = doc(db, "empresas", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setForm(prev => ({ ...prev, ...docSnap.data() }));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const atualizarCampo = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setForm(prev => ({ ...prev, [name]: checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const onChangeLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, logoBase64: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const salvarDados = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      await setDoc(doc(db, "empresas", user.uid), form);
      alert("Dados da empresa atualizados com sucesso!");
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Erro ao salvar dados da empresa:", error);
      alert("Erro ao salvar dados, tente novamente.");
    }
  };

  if (loading) return <p className="text-center py-10">Carregando dados...</p>;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-60 flex justify-center items-center z-50 p-4 transition-all">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 animate__animated animate__fadeIn animate__faster">
        {/* Botão Fechar */}
        <button
          onClick={onComplete}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none"
          aria-label="Fechar"
        >
          &times;
        </button>

        <h2 className="text-2xl font-semibold text-gray-800 text-center mb-4">
          Atualizar Dados da Empresa
        </h2>

        {/* Adicionando a classe overflow-y-auto para permitir o scroll */}
        <form onSubmit={salvarDados} className="space-y-6 pb-4 max-h-[80vh] overflow-y-auto">
          {[
            { label: "Nome da Empresa", name: "nomeEmpresa" },
            { label: "Morada", name: "morada" },
            { label: "Código Postal", name: "codigoPostal" },
            { label: "Localidade", name: "localidade" },
            { label: "Contacto", name: "contacto" },
            { label: "Email", name: "email", type: "email" },
            { label: "NIF", name: "nif" },
          ].map(({ label, name, type = "text" }) => (
            <div key={name} className="grid grid-cols-1 gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}:
              </label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={atualizarCampo}
                required={name === "nomeEmpresa"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          ))}

          {/* Campo para editar a mensagem de WhatsApp */}
          <div className="grid grid-cols-1 gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem de WhatsApp:
            </label>
            <textarea
              name="mensagemWhatsapp"
              value={form.mensagemWhatsapp}
              onChange={atualizarCampo}
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="Digite a mensagem que será enviada via WhatsApp."
            />
          </div>

          {/* Checkbox para habilitar ou desabilitar o envio da mensagem de WhatsApp */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="enviarMensagemWhatsapp"
              checked={form.enviarMensagemWhatsapp}
              onChange={atualizarCampo}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">
              Enviar mensagem de WhatsApp ao alterar o status para "pronto para entrega"
            </label>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo da Empresa:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={onChangeLogo}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300 rounded"
            />
          </div>

          {form.logoBase64 && (
            <div className="mt-2 text-center">
              <img
                src={form.logoBase64}
                alt="Preview do logo"
                className="max-h-24 max-w-xs border border-gray-300 p-2 object-contain rounded-lg mx-auto"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition"
          >
            Salvar
          </button>
        </form>
      </div>
    </div>
  );
}
