import './index.css';
import { useState, useEffect } from "react";
import FormularioRececao from "./FormularioRececao";
import FormularioEntrega from "./FormularioEntrega";
import HistoricoServicos from "./Histórico";
import Dashboard from "./Dashboard";
import GestaoClientes from "./GestãoClientes";
import { AuthProvider, useAuth } from "./AuthProvider";
import Login from "./Auth";
import CompanySettings from "./CompanySettings";
import { db, auth } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { FiLogOut } from "react-icons/fi";

function AppContent() {
  const { user } = useAuth();
  const [empresaPronta, setEmpresaPronta] = useState(false);
  const [verificandoEmpresa, setVerificandoEmpresa] = useState(true);
  const [pagina, setPagina] = useState("rececao");
  const [mostrarSettings, setMostrarSettings] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const verificarEmpresa = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "empresas", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEmpresaPronta(true);
        }
      } catch (err) {
        console.error("Erro ao verificar dados da empresa:", err);
      } finally {
        setVerificandoEmpresa(false);
      }
    };
    verificarEmpresa();
  }, [user]);

  if (!user) return <Login />;
  if (verificandoEmpresa) return <p className="p-5">A verificar dados da empresa...</p>;
  if (!empresaPronta)
    return <CompanySettings onComplete={() => setEmpresaPronta(true)} />;

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex gap-4">
          {/* Menu para telas pequenas (Hamburger) */}
          <button 
            onClick={() => setMenuAberto(!menuAberto)} 
            className="sm:hidden text-white p-2">
            <span className="text-xl">☰</span>
          </button>

          {/* Menu para dispositivos maiores */}
          <div className={`sm:flex gap-4 ${menuAberto ? 'block' : 'hidden'}`}>
            <button onClick={() => setPagina("rececao")} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition">Receção</button>
            <button onClick={() => setPagina("entrega")} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition">Entrega</button>
            <button onClick={() => setPagina("historico")} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition">Histórico</button>
            <button onClick={() => setPagina("dashboard")} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition">Dashboard</button>
            <button onClick={() => setPagina("gestaoClientes")} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition">Gestão de Clientes</button>
            <button onClick={() => setMostrarSettings(true)} className="px-4 py-2 border border-white rounded hover:bg-gray-700 transition ml-4">Definições</button>
          </div>
        </div>
        {/* Botão de logout */}
        <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition">
          <FiLogOut />
          Logout
        </button>
      </nav>

      <div className="p-6">
        {pagina === "rececao" && <FormularioRececao />}
        {pagina === "entrega" && <FormularioEntrega />}
        {pagina === "historico" && <HistoricoServicos />}
        {pagina === "dashboard" && <Dashboard />}
        {pagina === "gestaoClientes" && <GestaoClientes />}
      </div>

      {mostrarSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full relative">
            <button onClick={() => setMostrarSettings(false)} className="absolute top-3 right-4 text-xl font-bold text-gray-600 hover:text-gray-800" aria-label="Fechar">
              &times;
            </button>
            <CompanySettings onComplete={() => setMostrarSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
