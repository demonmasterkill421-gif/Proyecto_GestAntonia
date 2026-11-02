export function SeccionResumen({ titulo, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ecd3e6] bg-white">
      <h2 className="bg-[#f5e1f1] px-5 py-3 text-xl font-medium text-[#1f1218]">{titulo}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}