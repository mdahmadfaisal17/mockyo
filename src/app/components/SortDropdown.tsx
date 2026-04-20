import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SortOption {
  name: string;
  value: string;
}

const sortOptions: SortOption[] = [
  { name: "All", value: "all" },
  { name: "Popular", value: "popular" },
  { name: "Latest", value: "latest" },
  { name: "Most Downloaded", value: "downloads" },
];

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getSelectedLabel = () => {
    const option = sortOptions.find((opt) => opt.value === value);
    return option ? option.name : "All";
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 rounded-md bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all flex items-center justify-between min-w-[160px]"
      >
        <span>{getSelectedLabel()}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ml-2 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50 w-48"
          >
            <div className="py-2">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                    value === option.value ? "text-primary font-medium bg-muted/50" : ""
                  }`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
