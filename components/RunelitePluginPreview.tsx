const tasks = [
  { name: 'Receive a Berserker ring', detail: 'Dagannoth Rex', progress: 'OPEN', color: '#d8a83e' },
  { name: 'Gain 10m team Agility XP', detail: '7.4m / 10m XP', progress: '74%', color: '#789b52' },
  { name: 'Complete one Chambers raid', detail: 'Claim approved', progress: 'DONE', color: '#62a66b' },
] as const;

export function RunelitePluginPreview() {
  return (
    <div className="rounded-xl border border-[#6d5732] bg-[#11100e] p-3 shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[10px] font-bold text-[#aaa59a]">
        <span>TERRY&apos;S DRAFTING</span>
        <span className="rounded bg-[#29452d] px-2 py-1 text-[#a9d49d]">● SHARING LIVE</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
        <section className="rounded border border-[#51452f] bg-[#1c1b18] p-4">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#aaa089]">Weekend Lockout</p><h3 className="mt-1 text-lg font-bold text-[#e5d29b]">Team Dragon</h3></div>
            <div className="text-right"><p className="text-2xl font-black text-[#e1b64e]">240</p><p className="text-[9px] uppercase text-[#8e8778]">points · 1st</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {tasks.map((task) => (
              <article className="rounded border border-white/10 bg-black/25 p-3" key={task.name}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-8 w-1 rounded" style={{ background: task.color }} />
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#e1ddd2]">{task.name}</p><p className="mt-1 text-[10px] text-[#959087]">{task.detail}</p></div>
                  <span className="text-[9px] font-black" style={{ color: task.color }}>{task.progress}</span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="rounded border border-[#7a632f] bg-[#574317] px-3 py-2 text-center text-[10px] font-bold text-[#f2d484]">Submit a tile</span>
            <span className="rounded border border-white/15 bg-[#2a2925] px-3 py-2 text-center text-[10px] font-bold text-[#d3cec3]">Open full board</span>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8e8778]">In-game overlay</p>
            <div className="rounded border border-[#61563f] bg-[#181713]/95 p-3 shadow-xl">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-[#e4ce8c]">Dragon</span><span className="text-xs font-black text-[#e1b64e]">240 pts</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/40"><span className="block h-full w-[74%] rounded bg-[#789b52]" /></div>
              <p className="mt-2 text-[9px] text-[#9d978b]">Next: 2.6m Agility XP</p>
            </div>
          </div>
          <div className="rounded border border-[#51452f] bg-[#1c1b18] p-4 text-[10px] text-[#a8a195]">
            <p className="font-bold uppercase tracking-[0.1em] text-[#d5bd79]">Paired character</p>
            <p className="mt-2 text-sm font-bold text-[#e1ddd2]">TerryTheMole</p>
            <p className="mt-1">Event data only · disconnect anytime</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
