import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import './CustomSelect.css'

export default function CustomSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Selecione uma opção...',
    disabled = false,
    className = ''
}) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    // Click outside handler
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isOpen])

    const selectedOption = options.find(opt => String(opt.value) === String(value))

    const handleSelect = (option) => {
        if (disabled || option.disabled) return
        onChange(option.value)
        setIsOpen(false)
    }

    return (
        <div
            ref={containerRef}
            className={`custom-select-container ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
        >
            <button
                type="button"
                className="custom-select-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={`custom-select-label ${!selectedOption ? 'is-placeholder' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={15} className="custom-select-arrow" />
            </button>

            {isOpen && (
                <div className="custom-select-popover" role="listbox">
                    <div className="custom-select-list">
                        {options.map((option) => {
                            const isSelected = String(option.value) === String(value)
                            return (
                                <div
                                    key={option.value}
                                    className={`custom-select-option ${isSelected ? 'is-selected' : ''} ${option.disabled ? 'is-disabled' : ''}`}
                                    onClick={() => handleSelect(option)}
                                    role="option"
                                    aria-selected={isSelected}
                                >
                                    <span className="custom-select-option-text">{option.label}</span>
                                    {isSelected && <Check size={14} className="custom-select-check" />}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
