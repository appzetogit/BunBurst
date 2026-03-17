import { motion } from 'framer-motion';
import { Phone, Clock, Construction, Sparkles } from 'lucide-react';

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fdfdfd] dark:bg-[#0a0a0a] px-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#e53935]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative"
      >
        {/* Main Card */}
        <div className="relative bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden">
          
          {/* Top Icon Badge */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#e53935]/20 blur-xl rounded-full scale-150" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-[#e53935] to-[#c62828] flex items-center justify-center shadow-lg transform rotate-3">
                <Construction className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
              Coming Soon
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-1 w-12 bg-gradient-to-r from-transparent to-[#e53935] rounded-full" />
              <Sparkles className="h-4 w-4 text-amber-500" />
              <div className="h-1 w-12 bg-gradient-to-l from-transparent to-[#e53935] rounded-full" />
            </div>
          </div>

          {/* Contact Info Section */}
          <div className="space-y-4">
            {/* Phone Number Card */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="group p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <Phone className="h-5 w-5 text-[#e53935]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Order Online</p>
                  <a href="tel:+917400786759" className="text-base font-bold text-slate-900 dark:text-white group-hover:text-[#e53935] transition-colors uppercase tracking-tight">
                    +91 7400786759
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Timings Card */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="group p-5 rounded-3xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                  <Clock className="h-5 w-5 text-[#e53935]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-0.5">Order Timings</p>
                  <p className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    11:00 AM - 9:00 PM
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Footer Text */}
          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium italic">
              Experience the best flavors, arriving shortly.
            </p>
          </div>

        </div>

        {/* Outer Shadow/Glow */}
        <div className="absolute -inset-2 bg-gradient-to-r from-[#e53935]/10 to-amber-500/10 rounded-[3rem] blur-2xl -z-10 opacity-50" />
      </motion.div>
    </div>
  )
}
