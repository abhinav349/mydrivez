import Image from "next/image";

export function PageHero({ eyebrow, title, body, image = "/photos/road.jpg", children }: { eyebrow: string; title: React.ReactNode; body?: string; image?: string; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <Image src={image} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/60 via-ink/70 to-ink" />
      <div className="container pb-20 pt-36 lg:pb-24 lg:pt-44">
        <p className="eyebrow !text-lime">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-[1.02] tracking-tightest text-white sm:text-6xl">{title}</h1>
        {body && <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-white/60">{body}</p>}
        {children}
      </div>
    </section>
  );
}
