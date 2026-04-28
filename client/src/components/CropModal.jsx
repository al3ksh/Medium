import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check } from 'lucide-react'
import { useAnimatedClose } from '../utils'

function getCroppedImg(imageSrc, pixelCrop, outputWidth, outputHeight) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight
      const ctx = canvas.getContext('2d')

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputWidth,
        outputHeight
      )
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
    }
    image.src = imageSrc
  })
}

export default function CropModal({ imageSrc, aspect, outputWidth, outputHeight, onCrop, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const { closing, animatedClose } = useAnimatedClose(onCancel)

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedAreaPixels) return
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, outputWidth, outputHeight)
    onCrop(blob)
  }

  return (
    <div className={`crop-overlay ${closing ? 'closing' : ''}`}>
      <div className="crop-modal">
        <div className="crop-header">
          <h3>Crop Image</h3>
          <div className="crop-actions">
            <button className="crop-btn cancel" onClick={animatedClose}><X size={18} /></button>
            <button className="crop-btn confirm" onClick={handleConfirm}><Check size={18} /></button>
          </div>
        </div>
        <div className="crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="crop-zoom">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  )
}
