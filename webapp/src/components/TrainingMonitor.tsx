'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PlotData, Layout } from 'plotly.js';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false, loading: () => <div>Loading...</div> });

interface TrainingData {
    epoch: number;
    loss: number;
    train_acc: number;
    val_acc: number;
    test_acc: number;
}

interface ChartData extends Partial<PlotData> {
    x: number[];
    y: number[];
    name: string;
    type: 'scatter';
}

export default function TrainingMonitor() {
    // Add forceUpdate state
    const [, setForceUpdate] = useState({});
    
    // State for chart data with proper types
    const lossData = useRef<ChartData>({ x: [], y: [], name: 'Loss', type: 'scatter' });
    const trainAccData = useRef<ChartData>({ x: [], y: [], name: 'Train Acc', type: 'scatter' });
    const valAccData = useRef<ChartData>({ x: [], y: [], name: 'Val Acc', type: 'scatter' });
    const testAccData = useRef<ChartData>({ x: [], y: [], name: 'Test Acc', type: 'scatter' });
    
    useEffect(() => {
        // Create WebSocket connection
        const ws = new WebSocket(`ws://${process.env.NEXT_PUBLIC_WS_HOST}:${process.env.NEXT_PUBLIC_WS_PORT}`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data) as TrainingData;
            
            // Update loss data
            lossData.current.x = [...lossData.current.x, data.epoch];
            lossData.current.y = [...lossData.current.y, data.loss];
            
            // Update accuracy data
            trainAccData.current.x = [...trainAccData.current.x, data.epoch];
            trainAccData.current.y = [...trainAccData.current.y, data.train_acc];
            
            valAccData.current.x = [...valAccData.current.x, data.epoch];
            valAccData.current.y = [...valAccData.current.y, data.val_acc];
            
            testAccData.current.x = [...testAccData.current.x, data.epoch];
            testAccData.current.y = [...testAccData.current.y, data.test_acc];
            
            // Force re-render
            setForceUpdate({});
        };
        
        ws.onclose = () => {
            console.log('WebSocket connection closed');
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        return () => {
            ws.close();
        };
    }, []);
    
    const lossLayout: Partial<Layout> = {
        title: 'Training Loss',
        xaxis: { title: 'Epoch' },
        yaxis: { title: 'Loss' },
        margin: { t: 40 },
        autosize: true
    };

    const accuracyLayout: Partial<Layout> = {
        title: 'Accuracy Metrics',
        xaxis: { title: 'Epoch' },
        yaxis: { title: 'Accuracy', range: [0, 1] },
        margin: { t: 40 },
        autosize: true
    };
    
    return (
        <div className="space-y-8">
            <div className="h-[400px] w-full">
                <Plot
                    data={[lossData.current]}
                    layout={lossLayout}
                    useResizeHandler={true}
                    className="w-full h-full"
                />
            </div>
            
            <div className="h-[400px] w-full">
                <Plot
                    data={[trainAccData.current, valAccData.current, testAccData.current]}
                    layout={accuracyLayout}
                    useResizeHandler={true}
                    className="w-full h-full"
                />
            </div>
        </div>
    );
} 