import React, { useEffect, useRef, useState } from 'react';
import { Mic, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanGate } from '@/components/auth/PlanGate';

interface SearchBarProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  showVoicePlaceholder?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value: initialValue = '',
  onChange,
  placeholder = 'Search...',
  className,
  debounceMs = 250,
  showVoicePlaceholder = false,
}) => {
  const [value, setValue] = useState(initialValue);
  const isFirstRender = useRef(true);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      onChange(value);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, onChange, value]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN'; // Optimize for Indian locales

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setValue(transcript);
          onChange(transcript);
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [onChange]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Voice search is not supported in this browser. Please try Google Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  return (
    <div className={cn('relative flex w-full items-center', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={isListening ? 'Listening...' : placeholder}
        className={cn(
          'focus-ring aqua-input min-h-12 w-full rounded-2xl border border-border bg-white/95 pl-11 pr-12 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-all duration-200',
          showVoicePlaceholder && 'pr-23',
          isListening && 'border-rose-300 ring-2 ring-rose-500/20 bg-rose-50/10 placeholder-rose-400'
        )}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('');
              onChange('');
            }}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-text-muted hover:bg-surface-muted cursor-pointer"
            aria-label="Clear search"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        ) : null}
        {showVoicePlaceholder ? (
          <PlanGate feature="voice">
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                'flex h-9 min-w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-sm',
                isListening
                  ? 'bg-rose-500 border-rose-500 text-white animate-pulse'
                  : 'border-border bg-surface text-text-muted hover:bg-slate-50'
              )}
              aria-label={isListening ? 'Listening. Click to stop' : 'Start voice search'}
            >
              <Mic className={cn('h-4 w-4', isListening && 'animate-bounce')} />
            </button>
          </PlanGate>
        ) : null}
      </div>
    </div>
  );
};

export default SearchBar;

