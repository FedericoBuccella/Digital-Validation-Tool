import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ImageUploaderProps {
  onImageSelect: (file: File) => void
  onImageRemove: () => void
  selectedImage: File | null
  disabled?: boolean
}

export default function ImageUploader({ 
  onImageSelect, 
  onImageRemove, 
  selectedImage, 
  disabled = false 
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de imagen válido",
        variant: "destructive"
      })
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "El archivo es demasiado grande. Máximo 10MB permitido",
        variant: "destructive"
      })
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    onImageSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    onImageRemove()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      {selectedImage && imagePreview ? (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Vista previa del mapa de proceso"
                className="w-full h-64 object-contain rounded-lg border"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemoveImage}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <p><strong>Archivo:</strong> {selectedImage.name}</p>
              <p><strong>Tamaño:</strong> {(selectedImage.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            dragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFileDialog}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="p-4 rounded-full bg-muted">
                {dragOver ? (
                  <Upload className="h-8 w-8 text-primary" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {dragOver ? 'Suelta la imagen aquí' : 'Selecciona un mapa de proceso'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Arrastra y suelta una imagen o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos soportados: JPG, PNG, GIF, WebP (máx. 10MB)
                </p>
              </div>

              <Button variant="outline" disabled={disabled}>
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar Imagen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}