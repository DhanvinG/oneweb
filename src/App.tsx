import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, X, ArrowRight, Globe, Activity } from 'lucide-react';

export default function App() {
  const [showBanner, setShowBanner] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateNavigation = () => setIsScrolled(window.scrollY > 80);
    updateNavigation();
    window.addEventListener('scroll', updateNavigation, { passive: true });
    return () => window.removeEventListener('scroll', updateNavigation);
  }, []);

  return (
    <div className="w-full font-sans overflow-x-hidden">
      <div className="min-h-screen bg-[#3083FD] text-black relative">
        {/* Background Texture Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-40 mix-blend-multiply"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1603484477859-abe6a73f9366?auto=format&fit=crop&w=2000&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      ></div>

      <div className="relative">
        {/* Top Promotional Banner */}
        {showBanner && (
          <div className="bg-[#ccff00] px-4 py-2 flex justify-between items-center border-b-2 border-black">
            <a href="#" className="text-sm font-bold font-mono tracking-wide flex items-center gap-2 hover:underline">
              SHOP OUR LEGACY MERCH • FREE SHIPPING ON ORDERS OVER $50 <ArrowRight size={16} strokeWidth={3} />
            </a>
            <button onClick={() => setShowBanner(false)} className="hover:opacity-70 transition-opacity">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Navigation Bar */}
        {isScrolled && <div className="h-[120px] md:h-[147px]" aria-hidden="true" />}
        <nav
          className={`grid grid-cols-[auto_1fr_auto] transition-all duration-300 ${
            isScrolled
              ? 'fixed inset-x-0 top-0 z-[100] items-center bg-[#3083FD] px-8 py-3 shadow-[0_5px_0_rgba(0,0,0,0.16)] md:px-[65px]'
              : 'relative items-start px-8 py-8 md:px-[65px] md:py-[45px]'
          }`}
        >
          <a href="#" className="z-50 flex items-center transition-transform hover:scale-105" aria-label="OneWeb home">
            {isScrolled ? (
              <img src="/logoimage.png" alt="OneWeb" className="h-14 w-14 object-contain" />
            ) : (
              <div className="flex flex-col items-start gap-1 font-['Anton'] text-[2.2rem] uppercase leading-[0.85] tracking-tight text-black">
                <span>One</span>
                <span>Web</span>
              </div>
            )}
          </a>

          {/* Desktop Links & Actions */}
          <div className="hidden lg:flex items-center justify-end space-x-12 font-mono text-[17px] font-bold mt-[10px] pr-6">
            <a href="#our-work" className="hover:opacity-70">Our Work</a>
            <a
              href="#impact"
              className="hover:opacity-70"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById('impact')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Impact
            </a>
            <a href="https://swypeai.tech/about" className="hover:opacity-70">About Us</a>
            
            <button className="hover:opacity-70 ml-2">
              <Search size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-4 relative mt-[2px]">
            <a
              href="https://forms.gle/styaEYuFpZqvTemg7"
              target="_blank"
              rel="noreferrer"
              className="border-[2.5px] border-black w-[160px] h-[56px] flex items-center justify-center hover:bg-black hover:text-white transition-colors font-mono font-bold text-[15px]"
            >
              Join Us
            </a>
            
            <div className="relative">
              <button 
                className="border-[2.5px] border-black w-[129px] h-[57px] bg-[#ff5a00] hover:bg-black hover:text-white transition-colors font-mono font-bold text-[17px] tracking-wide"
              >
                Donate
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="mt-20 md:mt-24 flex flex-col items-center justify-start relative w-full max-w-[1100px] mx-auto px-4 z-20">
          
          {/* Hand-drawn Arrow */}
          <svg className="animate-arrow-draw absolute hidden md:block left-[-15%] xl:left-[-10%] top-[15%] w-[140px] h-[180px] text-white pointer-events-none drop-shadow-sm z-20 overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 100 150">
            <path pathLength="1" d="M 5,165 C -45,120 -5,25 70,20" />
            <path pathLength="1" d="M 45,5 L 75,20 L 55,40" />
          </svg>

          {/* Massive Headlines */}
          <h1 
            className="font-['Anton'] text-[3.8rem] sm:text-[5.5rem] md:text-[6.8rem] lg:text-[8rem] leading-[0.85] uppercase text-black text-center whitespace-nowrap z-20 relative mb-4 md:mb-6"
            style={{ letterSpacing: '-0.02em', transform: 'scaleY(1.05)' }}
          >
            Join The Fight
          </h1>
          
          <div className="relative inline-block text-center mt-2 md:mt-4">
            <span 
              className="relative z-10 font-['Anton'] text-[4.2rem] sm:text-[6rem] md:text-[7.5rem] lg:text-[8.8rem] leading-[0.8] uppercase text-white whitespace-nowrap inline-block"
              style={{ letterSpacing: '-0.03em', transform: 'scaleY(1.05)' }}
            >
              End <span className="relative">
                Digital Barriers
                {/* Highlighter Brush Effect */}
                <svg className="animate-highlight-swipe absolute bottom-[15%] left-[-2%] w-[104%] h-[75%] text-[#ebd346] z-20 mix-blend-multiply pointer-events-none" preserveAspectRatio="none" viewBox="0 0 500 100" fill="currentColor">
                  <path d="M 10,25 Q 250,25 490,20 L 495,90 Q 250,85 5,85 Z" opacity="0.55" />
                </svg>
              </span>
            </span>
          </div>

          <p className="mt-6 max-w-xl text-center text-[19px] leading-[1.6] font-medium font-sans z-20 relative">
            We’re building a future where everyone can access<br className="hidden md:block"/>
            and use the web independently.
          </p>

          <a
            href="https://forms.gle/styaEYuFpZqvTemg7"
            target="_blank"
            rel="noreferrer"
            className="mt-10 font-mono font-bold text-black text-lg border-b-[2px] border-white inline-block hover:text-white transition-colors pb-0.5 tracking-tight relative z-30"
          >
            Join Us
          </a>
        </div>

        {/* Photo Collage & Police Tape Section */}
        <div className="relative mt-16 md:mt-24 h-[500px] md:h-[650px] w-full flex justify-center">
          
          {/* Images Container */}
          <div className="relative w-full max-w-[1300px] h-full">
            {/* Left Image */}
            <div className="absolute -left-[5%] md:-left-[5%] -top-8 md:-top-16 w-[50%] md:w-[35%] rotate-[8deg] z-30 transition-transform duration-500 hover:scale-[1.03] hover:z-40">
              {/* Masking tape detail */}
              <div className="absolute top-[20%] -left-3 w-8 md:w-9 h-24 md:h-28 bg-[#e8e6e1]/90 shadow-sm z-40 rotate-[5deg]"></div>
              <img 
                src="/capitalimage.png" 
                alt="Protest chalk art" 
                className="w-full h-auto shadow-xl" 
              />
            </div>

            {/* Center Image */}
            <div className="absolute left-[25%] md:left-[35%] top-16 md:top-[80px] w-[55%] md:w-[31%] rotate-[-4deg] z-[60] transition-transform duration-500 hover:scale-[1.03]">
              {/* Masking tape detail */}
              <div className="absolute top-[40%] -left-3 w-8 md:w-9 h-24 md:h-32 bg-[#e8e6e1]/90 shadow-sm z-40 rotate-[-6deg]"></div>
              <div className="shadow-2xl overflow-hidden">
                <img 
                  src="/sxswimage.png" 
                  alt="Capitol protest" 
                  className="w-full h-auto -mb-[25%]" 
                />
              </div>
            </div>

            {/* Right Image */}
            <div className="absolute -right-[5%] md:-right-[5%] -top-2 md:-top-16 w-[50%] md:w-[35%] rotate-[6deg] z-10 transition-transform duration-500 hover:scale-[1.03] hover:z-40">
              {/* Masking tape detail */}
              <div className="absolute top-[30%] -left-3 w-8 md:w-9 h-24 md:h-28 bg-[#e8e6e1]/90 shadow-sm z-40 rotate-[-3deg]"></div>
              <img 
                src="/conferenceimage.jpg" 
                alt="Protest speaker" 
                className="w-full h-auto shadow-xl object-cover" 
              />
            </div>
          </div>

          {/* Yellow Police Tape */}
          <div className="absolute top-[35%] md:top-[35%] -left-[20%] w-[150%] bg-[#ccff00] text-black font-sans font-black text-lg md:text-xl tracking-tight py-1.5 rotate-[-12deg] z-50 shadow-lg flex whitespace-nowrap overflow-hidden">
            <div className="flex animate-marquee shrink-0">
              {[...Array(30)].map((_, i) => (
                <span key={i} className="mx-1.5 uppercase">END DIGITAL BARRIERS &bull;</span>
              ))}
            </div>
            {/* Duplicate for seamless infinite scroll */}
            <div className="flex animate-marquee shrink-0" aria-hidden="true">
              {[...Array(30)].map((_, i) => (
                <span key={i} className="mx-1.5 uppercase">END DIGITAL BARRIERS &bull;</span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* In Collaboration With Section */}
      <div className="w-full bg-[#f4f8f9] pt-0 pb-6 md:pt-0 md:pb-8 flex flex-col items-center justify-center relative z-20">
        <h2
          className="uppercase text-[1.5rem] md:text-[1.85rem] text-[#424b55] font-black tracking-[-0.035em] mb-8 md:mb-12 translate-y-[26px] md:translate-y-[30px]"
          style={{
            fontFamily: 'Arial Black, Arial, sans-serif',
          }}
        >
          In Collaboration With
        </h2>
        
        <div className="w-full max-w-[1200px] mx-auto px-6">
          <img
            src="/collaborationimage.png"
            alt="Organizations collaborating with OneWeb"
            className="block w-full h-auto object-contain translate-x-[21px]"
          />
          <div className="hidden">
          {/* Translators without Borders */}
          <div className="flex items-center gap-3 text-[#737575] hover:text-[#505252] transition-colors duration-300 cursor-pointer">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="w-[4px] h-8 bg-current rotate-45 absolute rounded-full"></div>
              <div className="w-[4px] h-8 bg-current -rotate-45 absolute rounded-full"></div>
              <div className="w-2.5 h-2.5 bg-current rounded-full absolute -top-1 -left-1"></div>
            </div>
            <div className="font-bold text-[1.1rem] md:text-[1.3rem] leading-[1.1] flex flex-col items-start font-sans tracking-tight">
              <span>Translators</span>
              <span>without Borders</span>
            </div>
          </div>

          {/* UNICEF */}
          <div className="flex items-center gap-1.5 text-[#737575] hover:text-[#505252] transition-colors duration-300 cursor-pointer">
            <span className="text-[2.2rem] md:text-[2.8rem] font-bold lowercase tracking-tighter">unicef</span>
            <Globe size={42} className="ml-1" strokeWidth={1.5} />
          </div>

          {/* Yale Climate Connections */}
          <div className="flex items-center gap-3 text-[#737575] hover:text-[#505252] transition-colors duration-300 cursor-pointer">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-[4px] border-current opacity-80"></div>
              <div className="w-10 h-10 rounded-full border-[4px] border-current opacity-80"></div>
            </div>
            <div className="flex flex-col leading-[1.1]">
              <span className="text-[10px] font-bold tracking-widest uppercase text-left opacity-70">Yale</span>
              <span className="font-bold text-[1.1rem] md:text-[1.2rem] text-left">Climate</span>
              <span className="font-bold text-[1.1rem] md:text-[1.2rem] text-left">Connections</span>
            </div>
          </div>

          {/* World Health Organization */}
          <div className="flex items-center gap-3 text-[#737575] hover:text-[#505252] transition-colors duration-300 cursor-pointer">
            <div className="w-12 h-12 rounded-full border-[2px] border-current flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border border-current flex items-center justify-center relative">
                <Activity size={24} strokeWidth={1.5} />
                <div className="absolute inset-0 border border-current rotate-45 rounded-full opacity-30"></div>
                <div className="absolute inset-0 border border-current -rotate-45 rounded-full opacity-30"></div>
              </div>
            </div>
            <div className="flex flex-col leading-[1.1] font-sans font-bold text-[1.1rem] md:text-[1.3rem] text-left">
              <span>World Health</span>
              <span>Organization</span>
            </div>
          </div>

          {/* UN Environment Programme */}
          <div className="flex items-center gap-2 text-[#737575] hover:text-[#505252] transition-colors duration-300 cursor-pointer mt-2 md:mt-4">
            <div className="flex flex-col leading-[1.1] font-bold text-left">
              <div className="flex items-center gap-1.5 text-[2.2rem] md:text-[2.6rem] tracking-tighter mb-1">
                UN <Globe size={30} strokeWidth={1.5} />
              </div>
              <span className="text-[15px] font-semibold opacity-90 tracking-tight">environment</span>
              <span className="text-[15px] font-semibold opacity-90 tracking-tight">programme</span>
            </div>
          </div>

          {/* ElevenLabs */}
          <div className="flex items-center text-[#737575] hover:text-[#505252] transition-colors duration-300 font-bold text-[1.8rem] md:text-[2.2rem] tracking-tight mt-2 md:mt-4 cursor-pointer">
            <span className="font-black tracking-tighter mr-1 opacity-80">II</span>ElevenLabs
          </div>

          {/* L'OREAL */}
          <div className="flex items-center text-[#737575] hover:text-[#505252] transition-colors duration-300 font-sans uppercase text-[2.5rem] md:text-[3rem] tracking-widest mt-2 md:mt-4 cursor-pointer font-light" style={{ transform: 'scaleY(0.95)' }}>
            L'ORÉAL
          </div>
          </div>
        </div>
      </div>

      {/* Impact Statistics */}
      <section id="impact" className="relative z-20 isolate w-full bg-[#ff0038] px-6 py-14 md:px-12 md:py-16">
        <div className="mx-auto grid max-w-[1000px] grid-cols-1 justify-items-center gap-x-3 gap-y-12 sm:grid-cols-3 md:gap-x-4 md:gap-y-8">
          {[
            ['250K+', 'People Reached'],
            ['30+', 'Countries'],
            ['$30K+', 'Funding Raised'],
          ].map(([value, label]) => (
            <div key={label} className="flex w-full flex-col items-center text-center text-white">
              <span
                className="w-full text-center font-sans text-[2.75rem] font-black leading-none tracking-[-0.055em] md:text-[4.5rem]"
              >
                {value}
              </span>
              <span
                className="mt-5 w-full text-center font-sans text-[1.4875rem] font-black uppercase leading-tight tracking-[-0.04em] md:mt-7 md:text-[1.9375rem]"
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Our Work in Action */}
      <section id="our-work" className="relative z-20 isolate overflow-hidden bg-[#f4f8f9] px-6 py-20 text-black md:px-12 md:py-28">
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-12 flex flex-col gap-5 md:mb-16 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#ff5a00]">
                What We Do
              </p>
              <h2 className="font-['Anton'] text-[3.5rem] uppercase leading-[0.9] tracking-[-0.025em] md:text-[5.5rem]">
                Our Work in Action
              </h2>
            </div>
            <p className="max-w-[470px] text-lg font-medium leading-relaxed text-[#424b55] md:pb-1 md:text-xl">
              We combine accessible technology, community knowledge, and public advocacy to make the web work for everyone.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 md:gap-7">
            {[
              {
                title: 'Digital Accessibility',
                description: 'Removing barriers from the online services and information people rely on every day.',
                image: '/codingimage.jpg',
                alt: 'Code displayed on a computer screen',
                href: 'https://swypeai.tech',
                cta: 'Explore Swype AI',
                accent: 'bg-[#ccff00]',
                position: 'md:-rotate-1',
              },
              {
                title: 'Community Training',
                description: 'Giving people the practical skills, tools, and confidence to participate online.',
                image: '/speakingimage.jpg',
                alt: 'A speaker leading a community training session',
                href: '#resources',
                cta: 'Learn More',
                accent: 'bg-[#ff5a00]',
                position: 'md:translate-y-6',
              },
              {
                title: 'Policy & Advocacy',
                description: 'Working with leaders and institutions to build accessibility into the systems they shape.',
                image: '/policyimage.jpeg',
                alt: 'People participating in policy and advocacy work',
                href: 'https://youthaccessibilitynetwork.org',
                cta: 'Work with Us',
                accent: 'bg-[#3083FD]',
                position: 'md:rotate-1',
              },
            ].map((item, index) => (
              <article
                key={item.title}
                className={`group relative border-[3px] border-black bg-white shadow-[8px_8px_0_#000] transition-transform duration-300 hover:-translate-y-2 ${item.position}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden border-b-[3px] border-black">
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className={`absolute left-4 top-4 flex h-11 w-11 items-center justify-center border-2 border-black font-mono text-sm font-black ${item.accent}`}>
                    0{index + 1}
                  </span>
                </div>

                <div className="flex min-h-[285px] flex-col p-6 md:p-7">
                  <h3 className="font-['Anton'] text-[2.35rem] uppercase leading-[0.95] tracking-[-0.02em]">
                    {item.title}
                  </h3>
                  <p className="mt-5 text-base font-medium leading-relaxed text-[#424b55] md:text-lg">
                    {item.description}
                  </p>
                  <a
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                    className="mt-auto inline-flex w-fit items-center gap-2 border-b-2 border-black pt-7 font-mono text-sm font-black uppercase tracking-tight transition-colors hover:text-[#ff5a00]"
                  >
                    {item.cta} <ArrowRight size={18} strokeWidth={3} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Act Now */}
      <section className="relative z-20 isolate overflow-hidden bg-[#3083FD] px-6 py-20 text-black md:px-12 md:py-28">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-col gap-12 md:gap-16">
            <div className="text-center">
              <p className="mb-4 font-mono text-sm font-black uppercase tracking-[0.14em] text-black/70">
                #OneWeb
              </p>
              <h2 className="font-['Anton'] text-[3.8rem] uppercase leading-[0.9] tracking-[-0.025em] sm:text-[4.8rem] md:text-[6rem]">
                Share What Access Means
              </h2>
              <p className="mx-auto mt-7 max-w-[680px] text-lg font-medium leading-relaxed text-black/75 md:text-xl">
                Start a conversation in your community. Tell people what digital accessibility means to you and why an inclusive web matters.
              </p>
            </div>

            <div>
              <div className="border-[3px] border-black bg-[#ccff00] p-7 text-center text-black shadow-[9px_9px_0_#000] md:p-10">
                <p className="font-mono text-xs font-black uppercase tracking-[0.15em]">Your post prompt</p>
                <p className="mx-auto mt-5 max-w-[850px] text-2xl font-black leading-tight tracking-[-0.035em] md:text-[2rem]">
                  Digital accessibility means
                </p>
                <div className="mx-auto mt-6 h-8 w-full max-w-[520px] border-b-[3px] border-black" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText('Digital accessibility means __________. #OneWeb')}
                  className="mt-7 border-2 border-black bg-black px-5 py-3 font-mono text-sm font-black uppercase text-white transition-colors hover:bg-[#ff5a00] hover:text-black"
                >
                  Copy the prompt
                </button>
              </div>

              <div className="mt-12 grid border-t-[3px] border-black pt-8 sm:grid-cols-3 sm:pt-0">
                {[
                  ['01', 'Reflect', 'Finish the sentence with a moment or experience that feels personal.'],
                  ['02', 'Post', 'Share your answer on Instagram, X, or LinkedIn with #OneWeb.'],
                  ['03', 'Invite', 'Tag friends and ask them what digital accessibility means to them.'],
                ].map(([number, title, description], index) => (
                  <div
                    key={title}
                    className={`flex min-h-[230px] flex-col items-start px-5 py-8 text-left md:px-8 ${index > 0 ? 'border-t-2 border-black/25 sm:border-l-2 sm:border-t-0' : ''}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center border-2 border-black bg-[#ff5a00] font-mono text-sm font-black text-black">
                      {number}
                    </span>
                    <h3 className="mt-6 text-2xl font-black uppercase tracking-[-0.04em]">{title}</h3>
                    <p className="mt-3 text-base font-medium leading-relaxed text-black/70">{description}</p>
                    {title === 'Post' && (
                      <div className="mt-auto flex flex-wrap gap-2 pt-6">
                        {[
                          ['Instagram', 'https://www.instagram.com/'],
                          ['X', 'https://twitter.com/intent/tweet?text=Digital%20accessibility%20means%20__________.%20%23OneWeb'],
                          ['LinkedIn', 'https://www.linkedin.com/feed/'],
                        ].map(([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 border-2 border-black px-3 py-2 font-mono text-xs font-black uppercase transition-colors hover:bg-black hover:text-white"
                          >
                            {platform} <ArrowRight size={14} strokeWidth={3} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* News and Stories */}
      <section id="news" className="relative z-20 isolate bg-[#f4f8f9] px-6 pt-20 pb-0 text-black md:px-12 md:pt-28 md:pb-0">
        <div className="mx-auto max-w-[1350px]">
          <div className="mb-12 text-center md:mb-16">
            <p className="mb-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-[#3083FD]">
              Members in the News
            </p>
            <h2 className="font-['Anton'] text-[4rem] uppercase leading-[0.9] tracking-[-0.025em] md:text-[6rem]">
              Featured Press
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {[
              ['Fox News Interview', 'https://www.youtube-nocookie.com/embed/C4euGWUddEE?start=2'],
              ['The Professor Kev Show', 'https://www.youtube-nocookie.com/embed/IsWOe77GAsE'],
            ].map(([title, url]) => (
              <article key={title}>
                <div className="overflow-hidden border-[3px] border-black bg-black shadow-[7px_7px_0_#000]">
                  <iframe
                    className="aspect-video w-full"
                    src={url}
                    title={title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <h3 className="mt-5 text-center text-2xl font-black uppercase tracking-[-0.035em]">{title}</h3>
              </article>
            ))}
          </div>

          <h3 className="mt-20 mb-8 font-['Anton'] text-[2.75rem] uppercase tracking-[-0.02em] md:text-[3.5rem]">
            In the News
          </h3>

          <div className="hidden">
            {[
              {
                publication: 'Northern Virginia Magazine',
                date: 'October 27, 2025',
                title: 'This High Schooler Is Making Computers More Accessible for People with Motor Disabilities',
                url: 'https://northernvirginiamag.com/family/education/2025/10/27/this-high-schooler-is-making-computers-more-accessible-for-people-with-motor-disabilities/',
                color: 'bg-[#3083FD]',
                textColor: 'text-white',
              },
              {
                publication: 'Global Student Prize',
                date: 'July 10, 2025',
                title: 'Dhanvin Ganeshkumar Announced Top 50 Finalist for the 2025 International Chegg Global Student Prize',
                url: 'https://globalteacherprize.org/news/global-student-prize-finalists/2025-finalists-global-student-prize/1886/1886-Dhanvinkumar-Ganeshkumar',
                color: 'bg-[#ccff00]',
                textColor: 'text-black',
              },
              {
                publication: 'Global Autoimmune Institute',
                date: 'Research Update',
                title: 'Teen Invents Free App That Could Help Those With Autoimmune Disease',
                url: 'https://www.autoimmuneinstitute.org/research_updates/teen-invents-free-app-that-could-help-those-with-autoimmune-disease/',
                color: 'bg-[#ff5a00]',
                textColor: 'text-black',
              },
              {
                publication: 'MIT RAISE',
                date: 'August 2025',
                title: 'Swype AI: 2025 MIT AI & Education Summit Accepted Paper',
                url: 'https://raise.mit.edu/wp-content/uploads/2025/08/Swype-AI-2025-MIT-AI-Education-Summit-Accepted-Paper-Publication.pdf',
                color: 'bg-[#ff0038]',
                textColor: 'text-white',
              },
              {
                publication: 'The Zebra',
                date: 'December 7, 2025',
                title: 'Meet the Teen Behind Swype AI, the Gesture-Control App Winning National Awards',
                url: 'https://thezebra.org/2025/12/07/meet-the-teen-behind-swype-ai-the-gesture-control-app-winning-national-awards/',
                color: 'bg-black',
                textColor: 'text-white',
              },
              {
                publication: 'Patch',
                date: 'August 5, 2025',
                title: 'TJ Students Develop Tool Helping People With Disabilities More Easily Use Computers',
                url: 'https://patch.com/virginia/oldtownalexandria/tj-student-develops-tool-help-people-disabilities-use-computers',
                color: 'bg-[#ff5a00]',
                textColor: 'text-black',
              },
              {
                publication: 'ARLnow',
                date: 'July 10, 2025',
                title: 'Local High Schooler Creates Assistive App for People with Motor Disabilities',
                url: 'https://www.arlnow.com/2025/07/10/arlington-high-schooler-creates-assistive-app-for-people-with-motor-disabilities/',
                color: 'bg-[#ccff00]',
                textColor: 'text-black',
              },
              {
                publication: 'Assistive Technology Blog',
                date: 'July 23, 2025',
                title: 'Swype AI Turns Your Hand into a Computer Mouse',
                url: 'https://assistivetechnologyblog.com/swype-ai/',
                color: 'bg-[#3083FD]',
                textColor: 'text-white',
              },
              {
                publication: 'Fairfax Times',
                date: 'Featured Coverage',
                title: 'Developing Affordable Technology',
                url: 'https://www.fairfaxtimes.com/articles/developing-affordable-tech/article_ce583804-a602-44b7-ba48-47c95b1fa00d.html',
                color: 'bg-[#ff0038]',
                textColor: 'text-white',
              },
            ].map((story, index) => (
              <article
                key={story.url}
                className={`group flex h-full flex-col border-[3px] border-black bg-white shadow-[7px_7px_0_#000] transition-transform duration-300 hover:-translate-y-2 ${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`}
              >
                <div className={`flex items-end border-b-[3px] border-black p-6 ${index === 0 ? 'min-h-[260px] md:min-h-[340px]' : 'aspect-[4/3]'} ${story.color} ${story.textColor}`}>
                  <p className={`font-['Anton'] uppercase leading-[0.95] tracking-[-0.02em] ${index === 0 ? 'text-[3rem] md:text-[4.5rem]' : 'text-[2.25rem]'}`}>
                    {story.publication}
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#5b626a]">{story.date}</p>
                  <h3 className="mt-4 text-xl font-black leading-tight tracking-[-0.035em]">{story.title}</h3>
                  <a
                    href={story.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex w-fit items-center gap-2 border-b-2 border-black pt-7 pb-1 font-mono text-xs font-black uppercase transition-colors hover:text-[#ff5a00]"
                  >
                    Read story <ArrowRight size={16} strokeWidth={3} />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div>
            <h3 className="sr-only">In the News</h3>
            <div className="grid gap-x-10 md:grid-cols-2">
              {[
                ['Northern Virginia Magazine', 'This High Schooler Is Making Computers More Accessible for People with Motor Disabilities', 'https://northernvirginiamag.com/family/education/2025/10/27/this-high-schooler-is-making-computers-more-accessible-for-people-with-motor-disabilities/'],
                ['Global Student Prize', 'Dhanvin Ganeshkumar Announced Top 50 Finalist for the 2025 International Chegg Global Student Prize', 'https://globalteacherprize.org/news/global-student-prize-finalists/2025-finalists-global-student-prize/1886/1886-Dhanvinkumar-Ganeshkumar'],
                ['Global Autoimmune Institute', 'Teen Invents Free App That Could Help Those With Autoimmune Disease', 'https://www.autoimmuneinstitute.org/research_updates/teen-invents-free-app-that-could-help-those-with-autoimmune-disease/'],
                ['MIT RAISE', 'Swype AI: 2025 MIT AI & Education Summit Accepted Paper', 'https://raise.mit.edu/wp-content/uploads/2025/08/Swype-AI-2025-MIT-AI-Education-Summit-Accepted-Paper-Publication.pdf'],
                ['The Zebra', 'Meet the Teen Behind Swype AI, the Gesture-Control App Winning National Awards', 'https://thezebra.org/2025/12/07/meet-the-teen-behind-swype-ai-the-gesture-control-app-winning-national-awards/'],
                ['Patch', 'TJ Students Develop Tool Helping People With Disabilities More Easily Use Computers', 'https://patch.com/virginia/oldtownalexandria/tj-student-develops-tool-help-people-disabilities-use-computers'],
                ['ARLnow', 'Local High Schooler Creates Assistive App for People with Motor Disabilities', 'https://www.arlnow.com/2025/07/10/arlington-high-schooler-creates-assistive-app-for-people-with-motor-disabilities/'],
                ['Assistive Technology Blog', 'Swype AI Turns Your Hand into a Computer Mouse', 'https://assistivetechnologyblog.com/swype-ai/'],
                ['Fairfax Times', 'Developing Affordable Technology', 'https://www.fairfaxtimes.com/articles/developing-affordable-tech/article_ce583804-a602-44b7-ba48-47c95b1fa00d.html'],
              ].map(([publication, title, url]) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-6 border-b-2 border-black/30 py-5 transition-colors hover:border-black"
                >
                  <span>
                    <span className="block font-mono text-xs font-black uppercase tracking-[0.1em] text-[#3083FD]">{publication}</span>
                    <span className="mt-2 block text-lg font-black leading-tight tracking-[-0.025em]">{title}</span>
                  </span>
                  <ArrowRight className="shrink-0 transition-transform group-hover:translate-x-1" size={20} strokeWidth={3} />
                </a>
              ))}
            </div>
          </div>

          <div id="resources" className="relative left-1/2 mt-24 w-screen -translate-x-1/2 bg-[#dcecff] px-6 py-16 md:px-12 md:py-20">
            <div className="mx-auto max-w-[1350px]">
            <div>
              <div>
                <p className="mb-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-[#ff5a00]">
                  Learn &amp; Share
                </p>
                <h3 className="font-['Anton'] text-[3.5rem] uppercase leading-[0.9] tracking-[-0.025em] md:text-[5rem]">
                  Resources
                </h3>
              </div>
            </div>

            <div className="relative mt-10">
              <div
                className="resource-scrollbar flex snap-x snap-mandatory gap-6 overflow-x-auto pb-5"
              >
                {[1, 2, 3, 4].map((slide) => (
                  <figure
                    key={slide}
                    className="min-w-[82%] snap-start overflow-hidden border-[3px] border-black bg-white shadow-[7px_7px_0_#000] last:mr-2 sm:min-w-[58%] lg:min-w-[38%]"
                  >
                    <img
                      src={`/${slide}.png`}
                      alt={`Digital accessibility explainer, slide ${slide} of 4`}
                      className="block h-auto w-full"
                    />
                  </figure>
                ))}
              </div>
            </div>

            <div className="mt-16">
              <h4 className="font-['Anton'] text-[2.5rem] uppercase tracking-[-0.02em] md:text-[3.25rem]">
                Essential Links
              </h4>
              <div className="mt-8 overflow-hidden border-[3px] border-black shadow-[8px_8px_0_#000]">
                {[
                  ['ADA.gov', 'Guidance on Web Accessibility and the ADA', 'Understand how the ADA applies to websites and digital services.', 'https://www.ada.gov/resources/web-guidance/', 'bg-white hover:bg-[#ccff00]'],
                  ['W3C WAI', 'Easy Checks for Web Accessibility', 'Run a quick first review of common accessibility issues.', 'https://www.w3.org/WAI/test-evaluate/easy-checks/', 'bg-white hover:bg-[#ccff00]'],
                  ['W3C WAI', 'WCAG 2 Overview', 'Explore the international standards for accessible web content.', 'https://www.w3.org/WAI/standards-guidelines/wcag/', 'bg-white hover:bg-[#ccff00]'],
                  ['Section508.gov', 'Test for Accessibility', 'Find testing methods and tools for websites, software, and documents.', 'https://www.section508.gov/test/', 'bg-white hover:bg-[#ccff00]'],
                ].map(([source, title, description, url, color], index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={`group grid gap-4 border-b-[3px] border-black p-6 transition-[padding] duration-300 last:border-b-0 hover:pl-8 md:grid-cols-[70px_170px_1fr_auto] md:items-center md:gap-7 md:p-7 md:hover:pl-10 ${color}`}
                  >
                    <span className="font-['Anton'] text-[2.5rem] leading-none tracking-[-0.03em]">
                      0{index + 1}
                    </span>
                    <span className="font-mono text-xs font-black uppercase tracking-[0.1em]">{source}</span>
                    <span>
                      <span className="block text-xl font-black leading-tight tracking-[-0.035em] md:text-2xl">{title}</span>
                      <span className="mt-2 block max-w-[620px] text-sm font-medium leading-relaxed text-black/70">{description}</span>
                    </span>
                    <span className="flex items-center justify-end">
                      <ArrowRight className="shrink-0 transition-transform group-hover:translate-x-2" size={24} strokeWidth={3} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Join Us */}
      <section className="hidden">
        <div className="pointer-events-none absolute -right-12 -top-28 font-['Anton'] text-[18rem] leading-none text-black/[0.07] md:text-[28rem]">
          +
        </div>
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="mb-4 font-mono text-sm font-black uppercase tracking-[0.14em]">Join Us</p>
            <h2 className="max-w-[850px] font-['Anton'] text-[4rem] uppercase leading-[0.88] tracking-[-0.025em] sm:text-[5.2rem] md:text-[7rem]">
              Help End Digital Barriers
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-4 md:flex-col">
            <a href="#" className="inline-flex min-w-[190px] items-center justify-between gap-6 border-[3px] border-black bg-[#ccff00] px-6 py-4 font-mono font-black uppercase shadow-[5px_5px_0_#000] transition-transform hover:-translate-y-1">
              Take Action <ArrowRight size={19} strokeWidth={3} />
            </a>
            <a href="#" className="inline-flex min-w-[190px] items-center justify-between gap-6 border-[3px] border-black bg-white px-6 py-4 font-mono font-black uppercase shadow-[5px_5px_0_#000] transition-transform hover:-translate-y-1">
              Join the Movement <ArrowRight size={19} strokeWidth={3} />
            </a>
          </div>
        </div>
      </section>

      {/* News and Stories */}
      <section className="hidden">
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 font-mono text-sm font-black uppercase tracking-[0.14em] text-[#3083FD]">Members in the News</p>
              <h2 className="font-['Anton'] text-[3.8rem] uppercase leading-[0.9] tracking-[-0.025em] md:text-[6rem]">
                News &amp; Stories
              </h2>
            </div>
            <a href="#" className="inline-flex w-fit items-center gap-2 border-b-2 border-black pb-1 font-mono text-sm font-black uppercase">
              View all stories <ArrowRight size={18} strokeWidth={3} />
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <article className="group flex min-h-[430px] flex-col justify-end overflow-hidden border-[3px] border-black bg-[#3083FD] p-7 shadow-[8px_8px_0_#000] md:min-h-[520px] md:p-10">
              <p className="font-mono text-xs font-black uppercase tracking-[0.15em]">Featured Member Story</p>
              <h3 className="mt-5 max-w-[850px] font-['Anton'] text-[3rem] uppercase leading-[0.95] tracking-[-0.02em] md:text-[5rem]">
                Meet the people building a more accessible web
              </h3>
              <p className="mt-6 max-w-[660px] text-lg font-medium leading-relaxed">
                Our members turn lived experience into practical change—inside communities, institutions, and the technology people use every day.
              </p>
              <a href="#" className="mt-8 inline-flex w-fit items-center gap-2 border-b-2 border-black pb-1 font-mono text-sm font-black uppercase">
                Read the story <ArrowRight size={18} strokeWidth={3} />
              </a>
            </article>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {[
                {
                  category: 'In the News',
                  title: 'How member voices are changing the accessibility conversation',
                  color: 'bg-[#ccff00]',
                },
                {
                  category: 'Community Story',
                  title: 'From a local idea to a movement for digital inclusion',
                  color: 'bg-white',
                },
              ].map((story) => (
                <article key={story.title} className={`flex min-h-[245px] flex-col border-[3px] border-black p-7 shadow-[7px_7px_0_#000] ${story.color}`}>
                  <p className="font-mono text-xs font-black uppercase tracking-[0.15em] text-[#424b55]">{story.category}</p>
                  <h3 className="mt-5 text-2xl font-black uppercase leading-tight tracking-[-0.035em]">{story.title}</h3>
                  <a href="#" className="mt-auto inline-flex w-fit items-center gap-2 border-b-2 border-black pt-7 pb-1 font-mono text-xs font-black uppercase">
                    Read more <ArrowRight size={16} strokeWidth={3} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-20 isolate border-b border-white/20 bg-black px-6 py-8 text-white md:px-12">
        <div className="mx-auto max-w-[1560px]">
          <p className="text-center text-sm font-medium md:text-base">
            © {new Date().getFullYear()} OneWeb. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
    </div>
  );
}
