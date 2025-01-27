import { expose } from 'comlink'
import { feature } from 'topojson-client'
import { geoOrthographic, geoPath } from 'd3-geo'
import topoData from '../assets/globe-topo.json'

/**
 * 1) Convert embedded TopoJSON into GeoJSON
 */
//@ts-ignore
const geoData = feature(topoData, topoData.objects.countries)

/**
 * 2) We'll store rotation state in the worker.
 *    Also store the D3 projection + path generator here.
 */
let rotation: [number, number, number] = [0, 0, 0]
let width = 800
let height = 800

// Initialize a projection and path generator once.
const projection = geoOrthographic()
    .rotate(rotation)
    .translate([width / 2, height / 2])
    .clipAngle(180)

const pathGenerator = geoPath(projection)

/**
 * 3) If you want to allow the main thread to set
 *    the width/height or other parameters, provide an API:
 */
function setDimensions(newWidth: number, newHeight: number) {
    width = newWidth
    height = newHeight

    // Update the projection with new dimensions
    projection
        .translate([width / 2, height / 2])
        .rotate(rotation) // keep the same rotation
        .clipAngle(180)
}

/**
 * 4) Update the rotation, compute all path strings,
 *    and return them. We also return the 'radius'
 *    so you can draw the outer circle in the main thread.
 */
function updateGlobePaths() {
    // Increment rotation
    rotation = [rotation[0] + 0.015, rotation[1] + 0.015, rotation[2]]

    // Update the projection
    projection.rotate(rotation)

    // Generate a path string for each feature
    //@ts-ignore
    const paths = (geoData.features || []).map((featureObj: any) => {
        return pathGenerator(featureObj) || ''
    })

    // The radius for the outer circle is the projection scale
    const radius = projection.scale()

    return {
        rotation,
        paths,
        radius,
    }
}

/**
 * 5) A simple getter for the GeoJSON, if needed.
 *    (You might not need this if we generate path strings each frame.)
 */
function getGeoData() {
    return geoData
}

/**
 * Expose the worker API via Comlink
 */
const api = {
    setDimensions,
    updateGlobePaths,
    getGeoData,
}
expose(api)
