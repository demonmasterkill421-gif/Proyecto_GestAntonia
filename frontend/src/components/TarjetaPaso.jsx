export function TarjetaPaso({ numero, titulo, children }) {
  return (
    <section className="flex flex-col rounded-3xl border border-[#f0d3e6] bg-[#f7e3f1] p-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f1218] text-sm font-semibold text-white">
          {numero}
        </span>
        <h2 className="text-xl font-semibold text-[#1f1218]">{titulo}</h2>
      </header>
      {children}
    </section>
  );
}