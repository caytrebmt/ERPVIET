import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { matchesVietnameseSearch } from '../utils/vietnamese';

export interface SelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  code?: string;
  badge?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string | number;
  onChange: (value: any, option?: SelectOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Chọn hoặc gõ tìm kiếm...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    bottom?: number;
    left: number;
    width: number;
    openAbove: boolean;
  }>({
    top: 0,
    left: 0,
    width: 280,
    openAbove: false,
  });

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const matchLabel = matchesVietnameseSearch(opt.label, searchTerm);
    const matchSub = opt.subLabel ? matchesVietnameseSearch(opt.subLabel, searchTerm) : false;
    const matchCode = opt.code ? matchesVietnameseSearch(opt.code, searchTerm) : false;
    return matchLabel || matchSub || matchCode;
  });

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;

      const calculatedWidth = Math.max(rect.width, 260);
      let leftPos = rect.left;
      if (leftPos + calculatedWidth > window.innerWidth - 12) {
        leftPos = Math.max(12, window.innerWidth - calculatedWidth - 12);
      }

      setCoords({
        top: rect.bottom + 4,
        bottom: viewportHeight - rect.top + 4,
        left: leftPos,
        width: calculatedWidth,
        openAbove,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option: SelectOption) => {
    onChange(option.value, option);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate min-w-0">
          {selectedOption ? (
            <>
              {selectedOption.code && (
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                  {selectedOption.code}
                </span>
              )}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <span className="text-[11px] text-zinc-400 truncate">({selectedOption.subLabel})</span>
              )}
            </>
          ) : (
            <span className="text-zinc-400 italic">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180 text-amber-500' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown Panel using Fixed Positioning */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            ...(coords.openAbove
              ? { bottom: `${coords.bottom}px`, top: 'auto' }
              : { top: `${coords.top}px`, bottom: 'auto' }),
            zIndex: 99999,
          }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Fast Search Input Bar */}
          <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/80 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm nhanh theo tên, mã SKU, MST..."
              className="w-full text-xs bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Option List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/50 p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        {opt.code && (
                          <span className="font-mono font-bold text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded shrink-0">
                            {opt.code}
                          </span>
                        )}
                        <span className="font-semibold truncate">{opt.label}</span>
                      </div>
                      {opt.subLabel && (
                        <span className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-amber-500" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-zinc-400">
                Không tìm thấy kết quả phù hợp cho "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;