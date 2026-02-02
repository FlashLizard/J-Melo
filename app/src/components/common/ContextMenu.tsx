// src/components/common/ContextMenu.tsx
import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1"
      style={{ top: y, left: x }}
    >
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <button
              onClick={() => {
                item.action();
                onClose();
              }}
              disabled={item.disabled}
              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
