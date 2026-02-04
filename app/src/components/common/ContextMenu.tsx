// src/components/common/ContextMenu.tsx
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for createPortal

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

    // Use mousedown instead of click to capture events before potential drag selections
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Render the menu using a portal to escape parent DOM structure
  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="absolute bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1"
      style={{ top: y, left: x }}
      // Prevent clicks on the menu from bubbling to parent container (LyricsDisplay) and triggering play/pause
      onClick={(e) => e.stopPropagation()} 
      onContextMenu={(e) => e.stopPropagation()} // Also stop context menu event if right-clicked on menu itself
    >
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Stop propagation for individual menu item clicks
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
    </div>,
    document.body // Render into document.body
  );
};

export default ContextMenu;