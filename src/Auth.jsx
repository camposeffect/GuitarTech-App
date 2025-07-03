import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore"; // Importar as funções necessárias do Firestore

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [errors, setErrors] = useState({ email: "", password: "" });

  const validar = () => {
    const novosErros = { email: "", password: "" };
    let valido = true;

    if (!email.includes("@") || !email.includes(".")) {
      novosErros.email = "Introduza um email válido.";
      valido = false;
    }

    if (password.length < 6) {
      novosErros.password = "A senha deve ter pelo menos 6 caracteres.";
      valido = false;
    }

    setErrors(novosErros);
    return valido;
  };

  // Função para criar o documento da empresa após o login ou registro
  const criarDocumentoEmpresa = async (userUid) => {
    const empresaRef = doc(db, "empresas", userUid); // O documento da empresa será a chave UID do usuário autenticado

    const docSnap = await getDoc(empresaRef);

    if (!docSnap.exists()) {
      try {
        // Criar um novo documento de empresa com os dados iniciais
        await setDoc(empresaRef, {
          nomeEmpresa: "Nome da Empresa",
          morada: "",
          codigoPostal: "",
          localidade: "",
          contacto: "",
          email: user.email,
          nif: "",
          logoBase64: "",
          "user.uid": user.uid, // Certifique-se de que o campo user.uid é sempre adicionado
          }, { merge: true }); 

        console.log("Documento da empresa criado com sucesso!");
      } catch (error) {
        console.error("Erro ao criar o documento da empresa:", error);
      }
    } else {
      console.log("Documento da empresa já existe.");
    }
  };

  const login = async () => {
    if (!validar()) return;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      await criarDocumentoEmpresa(userCredential.user.uid); // Chama a função para criar o documento da empresa
    } catch (err) {
      alert("Erro ao entrar: " + err.message);
    }
  };

  const register = async () => {
    if (!validar()) return;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      await criarDocumentoEmpresa(userCredential.user.uid); // Chama a função para criar o documento da empresa
    } catch (err) {
      alert("Erro ao registar: " + err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      {user ? (
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-md w-full">
          <p className="text-xl font-semibold mb-4">Bem-vindo, {user.email}</p>
          <button
            onClick={logout}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Sair
          </button>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Autenticação</h2>

          <div className="mb-4">
            <input
              type="email"
              placeholder="Email"
              className={`w-full px-4 py-2 border ${
                errors.email ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div className="mb-6">
            <input
              type="password"
              placeholder="Senha"
              className={`w-full px-4 py-2 border ${
                errors.password ? "border-red-500" : "border-gray-300"
              } rounded focus:outline-none focus:ring-2 focus:ring-blue-500`}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          <div className="flex justify-between gap-4">
            <button
              onClick={login}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
            >
              Entrar
            </button>
            <button
              onClick={register}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition"
            >
              Registar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
