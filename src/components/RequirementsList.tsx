import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UserRequirement, PRIORITY_COLORS } from '@/types/requirements'
import { Edit2, Trash2, AlertTriangle, Clock, CheckCircle, Brain } from 'lucide-react'

interface RequirementsListProps {
  requirements: UserRequirement[]
  onEdit: (requirement: UserRequirement) => void
  onDelete: (id: string) => void
}

const priorityIcons = {
  HIGH: AlertTriangle,
  MEDIUM: Clock,
  LOW: CheckCircle
}

export default function RequirementsList({ requirements, onEdit, onDelete }: RequirementsListProps) {
  if (requirements.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-300 mb-4">
          <Brain className="h-16 w-16 mx-auto" />
        </div>
        <p className="text-gray-500">
          No hay requerimientos creados. Crea el primero manualmente o usa la IA para generar desde un mapa de proceso.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requirements.map((requirement) => {
        const PriorityIcon = priorityIcons[requirement.priority]
        return (
          <Card key={requirement.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="secondary">{requirement.category}</Badge>
                    <Badge className={PRIORITY_COLORS[requirement.priority]}>
                      <PriorityIcon className="h-3 w-3 mr-1" />
                      {requirement.priority === 'HIGH' ? 'Alta' : 
                       requirement.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                    </Badge>
                    {requirement.prefix && requirement.number && (
                      <Badge variant="outline">
                        {requirement.prefix}-{requirement.number}
                      </Badge>
                    )}
                    {requirement.source === 'ai_generated' && (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Brain className="h-3 w-3 mr-1" />
                        IA
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-900 mb-2">{requirement.requirement}</p>
                  <p className="text-xs text-gray-500">
                    Creado el {new Date(requirement.created_at!).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(requirement)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(requirement.id!)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}