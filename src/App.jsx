import { useState } from 'react';
import MeseroPage from './pages/MeseroPage.jsx';
import CocinaPage from './pages/CocinaPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

function App() {
  const [view, setView] = useState('mesero');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">
              POS Hamburguesas
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300">
              Pedidos rápidos para TrailerBurguer 🍔
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 justify-start sm:justify-end text-xs sm:text-sm">
            <button
              onClick={() => setView('mesero')}
              className={`px-3 py-1.5 rounded-full border transition ${
                view === 'mesero'
                  ? 'bg-white text-slate-900 border-white'
                  : 'border-slate-500 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Mesero
            </button>
            <button
              onClick={() => setView('cocina')}
              className={`px-3 py-1.5 rounded-full border transition ${
                view === 'cocina'
                  ? 'bg-white text-slate-900 border-white'
                  : 'border-slate-500 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Cocina
            </button>
            <button
              onClick={() => setView('admin')}
              className={`px-3 py-1.5 rounded-full border transition ${
                view === 'admin'
                  ? 'bg-white text-slate-900 border-white'
                  : 'border-slate-500 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1">
        {view === 'mesero' && <MeseroPage />}
        {view === 'cocina' && <CocinaPage />}
        {view === 'admin' && <AdminPage />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-2 text-center text-[11px] sm:text-xs text-slate-500">
        Sistema interno – pos 24
      </footer>
    </div>
  );
}

export default App;
