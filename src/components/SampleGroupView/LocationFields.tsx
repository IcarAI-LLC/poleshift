
import {useState, useEffect, useCallback, useMemo, FC} from 'react'
import { useData } from '../../hooks'
import type { SampleGroupMetadata } from 'src/types'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'

interface Coordinate {
    value: string
    error: string
}

interface LocationFieldsProps {
    sampleGroup: SampleGroupMetadata
    metadataItemStyles?: string
    labelStyles?: string
    darkFieldStyles?: string
    disabled?: boolean
}

const COORDINATE_LIMITS = {
    latitude: { min: -90, max: 90 },
    longitude: { min: -180, max: 180 },
} as const

export const LocationFields: FC<LocationFieldsProps> = ({
                                                                  sampleGroup,
                                                                  // Use flex + items-center so label & input stay side by side
                                                                  metadataItemStyles = 'flex items-center gap-2 py-2',
                                                                  // Give the label a fixed or min-width so input doesn't wrap
                                                                  labelStyles = 'w-[180px] shrink-0 text-sm text-muted-foreground',
                                                                  darkFieldStyles = '',
                                                                  disabled = false,
                                                              }) => {
    const { updateSampleGroup } = useData()

    const [coordinates, setCoordinates] = useState<{
        latitude: Coordinate
        longitude: Coordinate
    }>({
        latitude: { value: '', error: '' },
        longitude: { value: '', error: '' },
    })

    useEffect(() => {
        setCoordinates({
            latitude: {
                value: sampleGroup.latitude_recorded?.toString() || '',
                error: '',
            },
            longitude: {
                value: sampleGroup.longitude_recorded?.toString() || '',
                error: '',
            },
        })
    }, [sampleGroup.latitude_recorded, sampleGroup.longitude_recorded])

    const fieldConfigs = useMemo(
        () => ({
            latitude: {
                label: 'Latitude:',
                placeholder: 'Enter latitude (-90 to 90)',
                min: COORDINATE_LIMITS.latitude.min,
                max: COORDINATE_LIMITS.latitude.max,
                errorMessage: 'Invalid latitude. Must be between -90 and 90.',
            },
            longitude: {
                label: 'Longitude:',
                placeholder: 'Enter longitude (-180 to 180)',
                min: COORDINATE_LIMITS.longitude.min,
                max: COORDINATE_LIMITS.longitude.max,
                errorMessage: 'Invalid longitude. Must be between -180 and 180.',
            },
        }),
        []
    )

    const validateCoordinate = useCallback(
        (value: string, type: 'latitude' | 'longitude'): boolean => {
            if (!value) return true
            const num = parseFloat(value)
            if (isNaN(num)) return false
            const limits = COORDINATE_LIMITS[type]
            return num >= limits.min && num <= limits.max
        },
        []
    )

    const handleCoordinateChange = useCallback(
        (value: string, type: 'latitude' | 'longitude') => {
            if (disabled) return
            setCoordinates((prev) => ({
                ...prev,
                [type]: {
                    value,
                    error: !validateCoordinate(value, type)
                        ? fieldConfigs[type].errorMessage
                        : '',
                },
            }))
        },
        [disabled, validateCoordinate, fieldConfigs]
    )

    const handleCoordinateUpdate = useCallback(
        async (type: 'latitude' | 'longitude') => {
            if (disabled || !sampleGroup.id) return
            const { value } = coordinates[type]
            // If invalid, revert
            if (!validateCoordinate(value, type)) {
                handleCoordinateChange(sampleGroup[`${type}_recorded`]?.toString() || '', type)
                return
            }

            try {
                const numericValue = value ? parseFloat(value) : null
                await updateSampleGroup(sampleGroup.id, {
                    [`${type}_recorded`]: numericValue,
                })
            } catch (error) {
                console.error(`Error updating ${type}:`, error)
                // revert on error
                handleCoordinateChange(sampleGroup[`${type}_recorded`]?.toString() || '', type)
            }
        },
        [
            disabled,
            sampleGroup,
            coordinates,
            validateCoordinate,
            handleCoordinateChange,
            updateSampleGroup,
        ]
    )

    const renderCoordinateField = useCallback(
        (type: 'latitude' | 'longitude') => {
            const config = fieldConfigs[type]
            const { value, error } = coordinates[type]

            return (
                <div key={type} className="flex items-start  py-1 ">
                    <Label className="w-36 text-sm font-medium leading-7 text-muted-foreground">{config.label}</Label>
                    <div className="flex-1">
                        <Input
                            type="number"
                            step="any"
                            min={config.min}
                            max={config.max}
                            value={value}
                            placeholder={config.placeholder}
                            disabled={disabled}
                            onChange={(e) => handleCoordinateChange(e.target.value, type)}
                            onBlur={() => handleCoordinateUpdate(type)}
                            className={`${darkFieldStyles} w-full text-sm`}
                        />
                        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                    </div>
                </div>
            )
        },
        [
            coordinates,
            fieldConfigs,
            metadataItemStyles,
            labelStyles,
            darkFieldStyles,
            handleCoordinateChange,
            handleCoordinateUpdate,
            disabled,
        ]
    )

    return (
        <>
            {renderCoordinateField('latitude')}
            {renderCoordinateField('longitude')}
        </>
    )
}

export default LocationFields
