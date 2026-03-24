import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl font-black shadow-lg shadow-blue-500/20">
            KV
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            WhisperZonez
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              Assistant
            </span>
          </h1>
          <p className="mt-3 text-zinc-400 text-lg font-mono">KVFX Intelligence Engine v3</p>
        </div>

        {/* Methodology */}
        <div className="flex items-center justify-center gap-2 text-sm font-mono flex-wrap">
          {["BIAS", "→", "ZONE", "→", "CONFIRMATION", "→", "EXECUTION"].map((word, i) => (
            <span
              key={i}
              className={
                word === "→"
                  ? "text-zinc-600"
                  : "text-zinc-300 bg-zinc-800 px-2 py-1 rounded border border-zinc-700"
              }
            >
              {word}
            </span>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {[
            {
              icon: "◈",
              title: "WhisperZonez",
              desc: "Supply, demand, and liquidity zone analysis with structure detection",
              color: "text-emerald-400",
            },
            {
              icon: "⟁",
              title: "KVFX Algo v3",
              desc: "Signal alignment scoring, directional bias, and entry timing logic",
              color: "text-blue-400",
            },
            {
              icon: "◉",
              title: "3 Trading Modes",
              desc: "Scalping, Swing, and Macro — each with tuned confirmation strictness",
              color: "text-violet-400",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
            >
              <div className={`text-xl mb-2 ${item.color}`}>{item.icon}</div>
              <h3 className="font-bold text-sm mb-1">{item.title}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div>
          <Link
            href="/assistant"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25 text-sm"
          >
            Open Intelligence Engine
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="text-zinc-600 text-xs leading-relaxed max-w-md mx-auto">
          Educational trading analysis tool only. Not financial advice.
          Trade your own plan. Past signals do not guarantee future results.
        </p>
      </div>
    </main>
  );
}
