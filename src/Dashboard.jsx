import { useEffect, useState, useRef } from "react";
import { db } from "./firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { useAuth } from "./AuthProvider";
import {
  Chart, BarController, BarElement, CategoryScale, LinearScale,
  LineController, LineElement, PointElement,
  DoughnutController, ArcElement, Tooltip, Legend,
} from "chart.js";

Chart.register(
  BarController, BarElement, CategoryScale, LinearScale,
  LineController, LineElement, PointElement,
  DoughnutController, ArcElement, Tooltip, Legend
);

export default function Dashboard() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const barRef = useRef(null);
  const lineRef = useRef(null);
  const donutRef = useRef(null);
  const chartsInit = useRef(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "empresas", user.uid, "servicos"));
    return onSnapshot(q, snap => {
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setServicos(dados);
      setFiltered(dados);
    });
  }, [user]);

  const getDate = s => {
    const d = s.dataEntrada || s.criadoEm;
    return d?.toDate ? d.toDate() : new Date(d);
  };

  const safeToDate = d => d?.toDate ? d.toDate() : new Date(d);

  const normalizarStatus = (status) => {
    if (!status) return "desconhecido";
    if (status === "pronto para entrega") return "pronto";
    return status;
  };

  useEffect(() => {
    if (!startDate || !endDate) {
      setFiltered(servicos);
      return;
    }
    const st = new Date(`${startDate}T00:00:00`);
    const en = new Date(`${endDate}T23:59:59`);

    const filt = servicos.filter(s => {
      const d = getDate(s);
      return d >= st && d <= en;
    });

    setFiltered(filt);
  }, [startDate, endDate, servicos]);

  useEffect(() => {
    const dataUse = filtered;

    const contMensal = Array(12).fill(0),
          entregues = Array(12).fill(0),
          statusLabels = ["em fila de espera", "a aguardar peças", "em manutenção", "pronto", "entregue"],
          statusCount = Object.fromEntries(statusLabels.map(s => [s, 0]));

    dataUse.forEach(s => {
      const d = getDate(s);
      if (!d || isNaN(d)) return;

      contMensal[d.getMonth()]++;
      if (normalizarStatus(s.status) === "entregue") entregues[d.getMonth()]++;

      const status = normalizarStatus(s.status);
      if (statusCount.hasOwnProperty(status)) {
        statusCount[status]++;
      } else {
        statusCount[status] = 1;
      }
    });

    const labels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const statusColors = {
      "em fila de espera": "#3B82F6",
      "a aguardar peças": "#FBBF24",
      "em manutenção": "#F472B6",
      "pronto": "#34D399",
      "entregue": "#059669",
      "desconhecido": "#D1D5DB"
    };

    if (chartsInit.current) {
      barRef.current.chart.data.datasets[0].data = contMensal;
      barRef.current.chart.update();
      lineRef.current.chart.data.datasets[0].data = contMensal;
      lineRef.current.chart.data.datasets[1].data = entregues;
      lineRef.current.chart.update();
      donutRef.current.chart.data.labels = Object.keys(statusCount);
      donutRef.current.chart.data.datasets[0].data = Object.values(statusCount);
      donutRef.current.chart.data.datasets[0].backgroundColor = Object.keys(statusCount).map(s => statusColors[s] || "#D1D5DB");
      donutRef.current.chart.update();
    } else {
      barRef.current.chart = new Chart(barRef.current, {
        type: "bar",
        data: { labels, datasets: [{ label: "Criados", data: contMensal, backgroundColor: "#3b82f6" }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
      lineRef.current.chart = new Chart(lineRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "Criados", data: contMensal, borderColor: "#6366f1", fill: false },
            { label: "Entregues", data: entregues, borderColor: "#10b981", fill: false },
          ],
        },
        options: { responsive: true }
      });
      donutRef.current.chart = new Chart(donutRef.current, {
        type: "doughnut",
        data: {
          labels: Object.keys(statusCount),
          datasets: [{
            data: Object.values(statusCount),
            backgroundColor: Object.keys(statusCount).map(s => statusColors[s] || "#D1D5DB")
          }]
        },
        options: { responsive: true }
      });
      chartsInit.current = true;
    }
  }, [filtered]);

  const total = filtered.length;
  const entregues = filtered.filter(s => normalizarStatus(s.status) === "entregue").length;

  // CORRIGIDO: Alteração no cálculo do faturado para somar apenas o campo `preco` dentro de `servicos`
  const faturado = filtered.reduce((a, s) => {
    // Somamos apenas os valores de preco dentro de servicos
    const precoServicos = Array.isArray(s.servicos) ? s.servicos.reduce((acc, item) => acc + parseFloat(item.preco || 0), 0) : 0;
    return a + precoServicos;
  }, 0);

  // CORRIGIDO: O cálculo do "Total Serviços" agora soma tanto o preço de serviços quanto de produtos
  const totalServicos = filtered.reduce((sum, s) => {
    const serv = Array.isArray(s.servicos) ? s.servicos.reduce((a, i) => a + parseFloat(i.preco || 0), 0) : 0;
    const prod = Array.isArray(s.produtos) ? s.produtos.reduce((a, i) => a + parseFloat(i.preco || 0), 0) : 0;
    return sum + serv + prod; // Agora somamos preço de serviços e produtos
  }, 0);

  const taxa = total ? ((entregues / total) * 100).toFixed(1) : 0;

  const mediaDias = (() => {
    const arr = filtered
      .map(s => {
        const entrada = safeToDate(s.dataEntrada);
        const entrega = safeToDate(s.dataEntrega);
        if (isNaN(entrada) || isNaN(entrega)) return null;
        return (entrega - entrada) / (1000 * 60 * 60 * 24);
      })
      .filter(v => v !== null && v >= 0);

    return arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
  })();

  const makeRank = key => Object.entries(filtered.reduce((acc, s) => {
    acc[s[key]] = (acc[s[key]] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const tipoRank = makeRank("tipoInstrumento");
  const clienteRank = makeRank("cliente");
  const marcaRank = makeRank("marca");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-bold text-center">📊 Dashboard</h2>
      <div className="flex gap-4 justify-center mb-6">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button onClick={() => { setStartDate(""); setEndDate(""); }} className="px-3">🔄 Reset</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        <Card label="Total" value={total} />
        <Card label="Entregues" value={entregues} />
        <Card label="Faturado" value={`${faturado.toFixed(2)} €`} />
        <Card label="Total Serviços" value={`${totalServicos.toFixed(2)} €`} />
        <Card label="Taxa" value={`${taxa} %`} />
        <Card label="Média dias" value={`${mediaDias}d`} />
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <RankCard title="Tipo Instrumento" data={tipoRank} />
        <RankCard title="Clientes" data={clienteRank} />
        <RankCard title="Marcas" data={marcaRank} />
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <ChartBox title="Serviços criados/mês"><canvas ref={barRef} /></ChartBox>
        <ChartBox title="Criados vs Entregues"><canvas ref={lineRef} /></ChartBox>
        <ChartBox title="Status"><canvas ref={donutRef} /></ChartBox>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Pendentes</h3>
        <ul>
          {filtered
            .filter(s => !["entregue", "pronto"].includes(normalizarStatus(s.status)))
            .sort((a, b) => getDate(a) - getDate(b))
            .slice(0, 10)
            .map(s => {
              const d = getDate(s);
              const dataTexto = d && !isNaN(d) ? d.toLocaleDateString() : "sem data";
              return <li key={s.id}>{s.cliente} – {s.tipoInstrumento} ({dataTexto})</li>;
            })}
        </ul>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="bg-white shadow rounded p-4 text-center">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function RankCard({ title, data }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="list-disc pl-5">
        {data.map(([k, c]) => <li key={k}>{k}: {c}</li>)}
      </ul>
    </div>
  );
}

function ChartBox({ title, children }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
