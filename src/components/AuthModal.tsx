import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, BarChart3, Chrome } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] rounded-[32px] bg-background border-border p-8">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-primary border-4 border-primary/20 rounded-[24px] grid place-items-center mb-6 shadow-2xl shadow-primary/20">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="font-display text-2xl font-black tracking-tight mb-2">
            EduTrack Intelligence
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            Secure cloud access for professional curriculum tracking and academic analytics.
          </p>
        </DialogHeader>

        <div className="mt-8 space-y-4">
          <div className="relative py-4 hidden">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">
              <span className="bg-background px-4">Authorized Personnel Only</span>
            </div>
          </div>

          <button
            disabled
            className="w-full py-4 rounded-2xl bg-muted border-2 border-border/60 text-muted-foreground text-sm font-bold opacity-50 cursor-not-allowed"
          >
            Institutional SSO (Coming Soon)
          </button>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-black uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            AES-256 Cloud Encryption
          </div>
          <p className="text-[10px] text-muted-foreground/60 max-w-[240px]">
            By authenticating, you agree to our{' '}
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('edutrack-nav', { detail: 'tos' })); onClose(); }}
              className="underline hover:text-primary"
            >Terms of Service</button> and{' '}
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('edutrack-nav', { detail: 'privacy' })); onClose(); }}
              className="underline hover:text-primary"
            >Privacy Policy</button>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
