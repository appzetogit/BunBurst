import { AlertCircle, Phone, Clock } from "lucide-react";

export default function ComingSoonBanner() {
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[40px] sm:h-[44px] bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 text-white shadow-md flex items-center justify-center border-b border-orange-400/30">
        <div 
          className="w-full h-full max-w-7xl mx-auto overflow-x-auto hide-scrollbar px-2 sm:px-4 flex items-center justify-start md:justify-center"
          style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6 text-[11px] sm:text-sm font-medium whitespace-nowrap min-w-max md:w-fit mx-auto">
            
            <div className="flex items-center gap-1.5 bg-white/20 px-2.5 py-0.5 sm:py-1 rounded-full shadow-sm backdrop-blur-sm shrink-0">
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="font-bold tracking-wide">Coming Soon!</span>
            </div>

            <div className="w-1 h-1 rounded-full bg-white/50 shrink-0"></div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-90" />
              <span className="hidden lg:inline opacity-90">To order online, please call:</span>
              <span className="lg:hidden opacity-90">Call:</span>
              <a href="tel:+917400786759" className="font-bold tracking-wide hover:text-amber-100 transition-colors underline decoration-white/40 underline-offset-2">
                +91 7400786759
              </a>
            </div>

            <div className="w-1 h-1 rounded-full bg-white/50 shrink-0"></div>

            <div className="flex items-center gap-1.5 shrink-0 pr-2 sm:pr-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-90" />
              <span className="hidden md:inline opacity-90">Order timings:</span>
              <span className="font-semibold tracking-wide">11:00 AM - 9:00 PM</span>
            </div>

          </div>
        </div>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  )
}
