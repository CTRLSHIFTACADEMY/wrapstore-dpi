import React, { useState } from 'react'
import { Image as ImageIcon, ZoomIn, X } from 'lucide-react'

const ProductImageHover = ({ src, alt = 'Product Image', title = '', size = 40, position = 'right' }) => {
  const [showLightbox, setShowLightbox] = useState(false)

  if (!src) {
    return (
      <div
        className="product-thumb-placeholder"
        style={{
          width: size,
          height: size,
          borderRadius: '8px',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
        }}
      >
        <ImageIcon size={Math.max(14, Math.floor(size * 0.4))} />
      </div>
    )
  }

  return (
    <>
      <div
        className={`product-thumb-wrapper ${position === 'left' ? 'preview-left' : ''}`}
        onClick={() => setShowLightbox(true)}
        style={{ cursor: 'zoom-in' }}
        title="Click to expand view"
      >
        {/* Thumbnail */}
        <div
          className="product-thumb"
          style={{ width: size, height: size, borderRadius: '8px', position: 'relative' }}
        >
          <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div className="thumb-zoom-badge">
            <ZoomIn size={10} color="white" />
          </div>
        </div>

        {/* Hover Popover Large Preview */}
        <div className="product-thumb-hover-preview">
          <img src={src} alt={alt} />
          {title && <div className="product-thumb-hover-title">{title}</div>}
          <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
            Click image for full-screen view
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => setShowLightbox(false)}
        >
          <div
            style={{
              position: 'relative',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowLightbox(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                zIndex: 10,
              }}
            >
              <X size={18} />
            </button>

            {/* Full Image */}
            <img
              src={src}
              alt={alt}
              style={{
                maxWidth: '80vw',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                background: '#f9fafb',
              }}
            />

            {title && (
              <div style={{
                marginTop: '12px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#111827',
                textAlign: 'center',
              }}>
                {title}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ProductImageHover
