import React from 'react'
import { wrap, Remote } from 'comlink'
import GlobeWorker from '../workers/globe.worker?worker'

// Shape of the worker's exposed methods
interface GlobeWorkerAPI {
    setDimensions: (w: number, h: number) => Promise<void>
    updateGlobePaths: () => Promise<{
        rotation: [number, number, number]
        paths: string[]
        radius: number
    }>
    getGeoData: () => Promise<any>
}

interface GlobeState {
    paths: string[]
    radius: number
}

class Globe extends React.Component<{}, GlobeState> {
    private worker: Worker | null = null
    private workerApi: Remote<GlobeWorkerAPI> | null = null
    private frameId: number | null = null

    constructor(props: {}) {
        super(props)
        this.state = {
            paths: [],
            radius: 100, // default radius
        }
    }

    componentDidMount() {
        // 1) Create the worker and wrap it
        this.worker = new GlobeWorker()
        this.workerApi = wrap<GlobeWorkerAPI>(this.worker)

        // 2) Initialize once dimension is known (say 800×800).
        //    You can also pass props or figure out container dims dynamically.
        this.initWorker(800, 800)
    }

    componentWillUnmount() {
        if (this.frameId) cancelAnimationFrame(this.frameId)
        if (this.worker) this.worker.terminate()
    }

    async initWorker(width: number, height: number) {
        if (!this.workerApi) return
        await this.workerApi.setDimensions(width, height)

        // 3) Start the animation loop (requestAnimationFrame)
        const animate = async () => {
            if (!this.workerApi) return
            // 4) Request new rotation + path strings from the worker
            const { paths, radius } = await this.workerApi.updateGlobePaths()

            // 5) Update local React state so we can re-render
            this.setState({ paths, radius })

            this.frameId = requestAnimationFrame(animate)
        }
        this.frameId = requestAnimationFrame(animate)
    }

    render() {
        const { paths, radius } = this.state

        // If you have a dynamic width/height, store them in state or pass as props
        const width = 800
        const height = 800

        return (
            <div style={{ width, height }}>
                <svg width={width} height={height}>
                    {/* Outer Circle (using worker-computed radius) */}
                    <circle
                        cx={width / 2}
                        cy={height / 2}
                        r={radius}
                        fill="rgba(200, 200, 200, 0.05)"
                        stroke="rgba(80, 80, 80, 0.5)"
                    />

                    {/* Render each path string */}
                    <g>
                        {paths.map((d, i) => (
                            <path
                                key={i}
                                d={d}
                                style={{
                                    fill: 'rgba(200, 200, 200, 0.3)',
                                    stroke: 'rgba(80, 80, 80, 0.5)',
                                    pointerEvents: 'none',
                                }}
                            />
                        ))}
                    </g>
                </svg>
            </div>
        )
    }
}

export default Globe
