'use client';

import { cn } from '../../lib/utils';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  ChevronRight,
  Files,
  Folder,
  Globe,
  Image,
  LayoutGrid,
  Mail,
  MessageSquare,
  Music,
  Search,
  Settings,
  StickyNote,
  Terminal
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Shortcut {
  query?: string;
  label: string;
  icon: React.ReactNode;
  link: string;
}

export interface SearchResult {
  id?: number;
  keywords?: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  link: string;
}

interface ShortcutButtonProps {
  onSelect?: () => void;
  icon: React.ReactNode;
  link: string;
}

const ShortcutButton = ({ icon, link, onSelect }: ShortcutButtonProps) => {
  return (
    <a href={link} onClick={onSelect ? (event) => { event.preventDefault(); onSelect(); } : undefined}>
      <div className="rounded-full cursor-pointer opacity-30 hover:opacity-100 transition-opacity duration-200">
        <div className="size-16 aspect-square flex items-center justify-center">{icon}</div>
      </div>
    </a>
  );
};

interface SpotlightPlaceholderProps {
  text: string;
  className?: string;
}

const SpotlightPlaceholder = ({ text, className }: SpotlightPlaceholderProps) => {
  return (
    <motion.div
      layout
      className={cn('absolute text-white/50 flex items-center pointer-events-none z-10', className)}
    >
      <AnimatePresence mode="popLayout">
        <motion.p
          layoutId={`placeholder-${text}`}
          key={`placeholder-${text}`}
          initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
};

interface SpotlightInputProps {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  handleClose?: () => void;
  placeholder: string;
  hidePlaceholder: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholderClassName?: string;
}

const SpotlightInput = ({
  placeholder,
  hidePlaceholder,
  value,
  onChange,
  placeholderClassName,
  inputRef: suppliedInputRef,
  handleClose
}: SpotlightInputProps) => {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = suppliedInputRef || localInputRef;

  useEffect(() => {
    // Focus the input when the component mounts
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex items-center w-full justify-start gap-2 px-6 h-16" role="search">
      <motion.div layoutId="search-icon">
        <Search />
      </motion.div>
      <div className="flex-1 relative text-2xl">
        {!hidePlaceholder && (
          <SpotlightPlaceholder text={placeholder} className={placeholderClassName} />
        )}

        <motion.input
          ref={inputRef}
          layout="position"
          type="text"
          aria-label="Search cinema promotions" aria-controls="cinema-search-results" autoComplete="off" spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none ring-none"
        />
      </div>
      {handleClose && <button type="button" aria-label="Close search" onClick={handleClose}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-white/65 hover:text-white focus-visible:outline-2 focus-visible:outline-cinema-cream">
        <span aria-hidden="true" className="text-2xl leading-none">×</span>
      </button>}
    </div>
  );
};

interface SearchResultCardProps extends SearchResult {
  onSelect?: () => void;
  isLast: boolean;
}

const SearchResultCard = ({ icon, label, description, link, isLast, onSelect }: SearchResultCardProps) => {
  return (
    <a href={link} onClick={onSelect ? (event) => { event.preventDefault(); onSelect(); } : undefined} className="overflow-hidden w-full group/card focus-visible:outline-2 focus-visible:outline-cinema-cream">
      <div
        className={cn(
          'flex items-center text-cinema-cream justify-start hover:bg-cinema-nav-hover gap-3 py-2 px-2 rounded-xl hover:shadow-md w-full',
          isLast && 'rounded-b-3xl'
        )}
      >
        <div className="size-8 [&_svg]:stroke-[1.5] [&_svg]:size-6 aspect-square flex items-center justify-center">
          {icon}
        </div>
        <div className="flex flex-col">
          <p className="font-medium">{label}</p>
          <p className="text-xs opacity-50">{description}</p>
        </div>
        <div className="flex-1 flex items-center justify-end opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
          <ChevronRight className="size-6" />
        </div>
      </div>
    </a>
  );
};

interface SearchResultsContainerProps {
  onSelect?: (result: SearchResult) => void;
  searchResults: SearchResult[];
  onHover: (index: number | null) => void;
}

const SearchResultsContainer = ({ searchResults, onHover, onSelect }: SearchResultsContainerProps) => {
  return (
    <motion.div
      layout
      id="cinema-search-results"
      data-lenis-prevent
      onMouseLeave={() => onHover(null)}
      className="px-2 border-white/15 border-t flex flex-col max-h-96 overflow-y-auto w-full py-2"
    >
      <span className="sr-only" role="status">{searchResults.length} promotions found</span>
      {!searchResults.length && <p className="px-4 py-5 text-sm text-white/50">No promotions found. Try “student”, “Wednesday” or “late”.</p>}
      {searchResults.map((result, index) => {
        return (
          <motion.div
            key={`search-result-${index}`}
            onMouseEnter={() => onHover(index)} onFocus={() => onHover(index)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              delay: index * 0.1,
              duration: 0.2,
              ease: 'easeOut'
            }}
          >
            <SearchResultCard
              icon={result.icon}
              label={result.label}
              description={result.description}
              link={result.link}
              isLast={index === searchResults.length - 1}
              onSelect={onSelect ? () => onSelect(result) : undefined}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
};

interface AppleSpotlightProps {
  results?: SearchResult[];
  onSelect?: (result: SearchResult) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onExitComplete?: () => void;
  interactive?: boolean;
  shortcuts?: Shortcut[];
  isOpen?: boolean;
  handleClose?: () => void;
}

const AppleSpotlight = ({
  shortcuts = [
    {
      label: 'Apps',
      icon: <LayoutGrid />,
      link: '/docs/components'
    },
    {
      label: 'Files',
      icon: <Folder />,
      link: '/docs/texts'
    },
    {
      label: 'Actions',
      icon: <Activity />,
      link: '/docs/buttons'
    },
    {
      label: 'Clipboard',
      icon: <Files />,
      link: '/docs/backgrounds'
    }
  ],
  isOpen = true,
  handleClose = () => {},
  results, onSelect, inputRef, onExitComplete, interactive = true
}: AppleSpotlightProps) => {
  const [hovered, setHovered] = useState(false);
  const [hoveredSearchResult, setHoveredSearchResult] = useState<number | null>(null);
  const [hoveredShortcut, setHoveredShortcut] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const handleSearchValueChange = (value: string) => {
    setSearchValue(value);
    setHoveredSearchResult(null);
    setHoveredShortcut(null);
  };

  const defaultSearchResults: SearchResult[] = [
    {
      icon: <Globe />,
      label: 'Twitter',
      description: 'Follow me on Twitter',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Globe />,
      label: 'Safari',
      description: 'Open Safari web browser',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Mail />,
      label: 'Mail',
      description: 'Open Mail application',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Calendar />,
      label: 'Calendar',
      description: 'View your calendar events',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <StickyNote />,
      label: 'Notes',
      description: 'Open Notes application',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Image />,
      label: 'Photos',
      description: 'Browse your photo library',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Settings />,
      label: 'System Settings',
      description: 'Open System Preferences',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Terminal />,
      label: 'Terminal',
      description: 'Open Terminal application',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Folder />,
      label: 'Finder',
      description: 'Open Finder file manager',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <MessageSquare />,
      label: 'Messages',
      description: 'Open Messages application',
      link: 'https://x.com/samitkapoorr'
    },
    {
      icon: <Music />,
      label: 'Music',
      description: 'Open Music application',
      link: 'https://x.com/samitkapoorr'
    }
  ];

  const searchResults = results
    ? results.filter(result => (result.keywords || `${result.label} ${result.description}`).toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase()))
    : defaultSearchResults;

  return (
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {isOpen && (
        <motion.div
          initial={{
            opacity: 0,
            filter: 'blur(20px)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: -10
          }}
          animate={{
            opacity: 1,
            filter: 'blur(0px)',
            scaleX: 1,
            scaleY: 1,
            y: 0,
            transitionEnd: { filter: 'none' }
          }}
          exit={{
            opacity: 0,
            filter: 'blur(20px)',
            scaleX: 1.3,
            scaleY: 1.1,
            y: 10,
            transition: { duration: 0.3, ease: 'easeIn' }
          }}
          transition={{
            type: 'spring',
            stiffness: 170,
            damping: 17,
            opacity: { duration: 0.5, ease: 'easeOut' },
            filter: { duration: 0.6, ease: 'easeOut' }
          }}
          className="cinema-spotlight-source relative z-50 flex flex-col items-center justify-center" data-spotlight-motion
          onClick={handleClose}
        >
          <div
            data-spotlight-hover inert={!interactive}
            onMouseEnter={() => { if (interactive && window.matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)').matches) setHovered(true); }}
            onMouseLeave={() => {
              setHovered(false);
              setHoveredShortcut(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full flex items-center justify-end gap-4 z-20 group',
              '[&>div]:bg-black/55 [&>div]:text-cinema-cream [&>div]:rounded-full [&>div]:backdrop-blur-xl [&>div]:backdrop-saturate-150 [&>div]:shadow-[inset_0_1px_0_#ffffff14]',
              '[&_svg]:size-7 [&_svg]:stroke-[1.4]',
              'max-w-3xl'
            )}
          >
            <AnimatePresence mode="popLayout">
              <motion.div
                layoutId="search-input-container"
                data-spotlight-field
                transition={{
                  layout: {
                    duration: 0.5,
                    type: 'spring',
                    bounce: 0.2
                  }
                }}
                style={{
                  borderRadius: '30px'
                }}
                className="h-full w-full flex flex-col items-center justify-start z-10 relative overflow-hidden border border-white/15"
              >
                <SpotlightInput
                  inputRef={inputRef} handleClose={handleClose}
                  placeholder={
                    hoveredShortcut !== null
                      ? shortcuts[hoveredShortcut].label
                      : hoveredSearchResult !== null
                      ? searchResults[hoveredSearchResult].label
                      : 'Search'
                  }
                  placeholderClassName={
                    hoveredSearchResult !== null ? 'text-black bg-white' : 'text-white/50'
                  }
                  hidePlaceholder={!(hoveredSearchResult !== null || !searchValue)}
                  value={searchValue}
                  onChange={handleSearchValueChange}
                />

                {searchValue && (
                  <SearchResultsContainer
                    searchResults={searchResults}
                    onHover={setHoveredSearchResult} onSelect={onSelect}
                  />
                )}
              </motion.div>
              {interactive && hovered &&
                !searchValue &&
                shortcuts.map((shortcut, index) => (
                  <motion.div
                    key={`shortcut-${index}`}
                    onMouseEnter={() => setHoveredShortcut(index)}
                    layout
                    initial={{ scale: 0.7, x: -1 * (64 * (index + 1)), opacity: 0 }}
                    animate={{ scale: 1, x: 0, opacity: 1 }}
                    exit={{
                      scale: 0.7,
                      x:
                        1 *
                        (16 * (shortcuts.length - index - 1) + 64 * (shortcuts.length - index - 1)),
                      opacity: 0
                    }}
                    transition={{
                      duration: 0.8,
                      type: 'spring',
                      bounce: 0.2,
                      delay: index * 0.05,
                      opacity: { duration: 0.3, ease: 'easeOut', delay: index * 0.05 }
                    }}
                    className="cinema-spotlight-shortcuts rounded-full cursor-pointer"
                  >
                    <ShortcutButton icon={shortcut.icon} link={shortcut.link} onSelect={shortcut.query === undefined ? undefined : () => { handleSearchValueChange(shortcut.query!); setHoveredShortcut(null); inputRef?.current?.focus({ preventScroll: true }); }} />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { AppleSpotlight };
