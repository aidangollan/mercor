declare module 'react-graph-vis' {
  import { Component } from 'react';
  
  export interface GraphData {
    nodes: Array<Node>;
    edges: Array<Edge>;
  }
  
  export interface Node {
    id: string;
    label?: string;
    title?: string;
    color?: string | {
      border?: string;
      background?: string;
      highlight?: string | {
        border?: string;
        background?: string;
      };
      hover?: string | {
        border?: string;
        background?: string;
      };
    };
    size?: number;
    value?: number;
    [key: string]: any;
  }
  
  export interface Edge {
    id?: string;
    from: string;
    to: string;
    label?: string;
    arrows?: string | {
      to?: boolean | {
        enabled?: boolean;
        scaleFactor?: number;
        type?: string;
      };
      from?: boolean | {
        enabled?: boolean;
        scaleFactor?: number;
        type?: string;
      };
      middle?: boolean | {
        enabled?: boolean;
        scaleFactor?: number;
        type?: string;
      };
    };
    color?: string | {
      color?: string;
      highlight?: string;
      hover?: string;
      inherit?: boolean | string;
      opacity?: number;
    };
    width?: number;
    dashes?: boolean | Array<number>;
    smooth?: boolean | {
      enabled: boolean;
      type: string;
      forceDirection?: string | boolean;
      roundness?: number;
    };
    [key: string]: any;
  }
  
  export interface Options {
    layout?: {
      hierarchical?: {
        enabled?: boolean;
        levelSeparation?: number;
        nodeSpacing?: number;
        treeSpacing?: number;
        blockShifting?: boolean;
        edgeMinimization?: boolean;
        parentCentralization?: boolean;
        direction?: string;
        sortMethod?: string;
        shakeTowards?: string;
      };
      improvedLayout?: boolean;
      randomSeed?: number;
    };
    edges?: {
      arrows?: {
        to?: boolean | {
          enabled?: boolean;
          scaleFactor?: number;
          type?: string;
        };
        from?: boolean | {
          enabled?: boolean;
          scaleFactor?: number;
          type?: string;
        };
        middle?: boolean | {
          enabled?: boolean;
          scaleFactor?: number;
          type?: string;
        };
      };
      endPointOffset?: {
        from?: number;
        to?: number;
      };
      arrowStrikethrough?: boolean;
      color?: string | {
        color?: string;
        highlight?: string;
        hover?: string;
        inherit?: boolean | string;
        opacity?: number;
      };
      dashes?: boolean | Array<number>;
      font?: {
        color?: string;
        size?: number;
        face?: string;
        background?: string;
        strokeWidth?: number;
        strokeColor?: string;
        align?: string;
        vadjust?: number;
        multi?: boolean | string;
        bold?: boolean | string;
        boldital?: boolean | string;
        ital?: boolean | string;
        mono?: boolean | string;
      };
      hidden?: boolean;
      hoverWidth?: number | Function;
      label?: string;
      labelHighlightBold?: boolean;
      length?: number | Function;
      physics?: boolean;
      scaling?: {
        min?: number;
        max?: number;
        label?: {
          enabled?: boolean;
          min?: number;
          max?: number;
          maxVisible?: number;
          drawThreshold?: number;
        };
        customScalingFunction?: Function;
      };
      selectionWidth?: number | Function;
      selfReferenceSize?: number;
      selfReference?: {
        size?: number;
        angle?: number;
        renderBehindTheNode?: boolean;
      };
      shadow?: boolean | {
        enabled?: boolean;
        color?: string;
        size?: number;
        x?: number;
        y?: number;
      };
      smooth?: boolean | {
        enabled?: boolean;
        type?: string;
        forceDirection?: string | boolean;
        roundness?: number;
      };
      title?: string;
      value?: number;
      width?: number;
      widthConstraint?: number | {
        maximum?: number;
      };
    };
    nodes?: {
      borderWidth?: number;
      borderWidthSelected?: number;
      brokenImage?: string;
      color?: string | {
        border?: string;
        background?: string;
        highlight?: string | {
          border?: string;
          background?: string;
        };
        hover?: string | {
          border?: string;
          background?: string;
        };
      };
      fixed?: {
        x?: boolean;
        y?: boolean;
      };
      font?: {
        color?: string;
        size?: number;
        face?: string;
        background?: string;
        strokeWidth?: number;
        strokeColor?: string;
        align?: string;
        vadjust?: number;
        multi?: boolean | string;
        bold?: boolean | string;
        boldital?: boolean | string;
        ital?: boolean | string;
        mono?: boolean | string;
      };
      group?: string;
      hidden?: boolean;
      icon?: {
        face?: string;
        code?: string;
        size?: number;
        color?: string;
      };
      image?: string | {
        selected?: string;
        unselected?: string;
      };
      label?: string;
      labelHighlightBold?: boolean;
      level?: number;
      margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
      mass?: number;
      physics?: boolean;
      scaling?: {
        min?: number;
        max?: number;
        label?: {
          enabled?: boolean;
          min?: number;
          max?: number;
          maxVisible?: number;
          drawThreshold?: number;
        };
        customScalingFunction?: Function;
      };
      shadow?: boolean | {
        enabled?: boolean;
        color?: string;
        size?: number;
        x?: number;
        y?: number;
      };
      shape?: string;
      shapeProperties?: {
        borderDashes?: boolean | number[];
        borderRadius?: number;
        interpolation?: boolean;
        useImageSize?: boolean;
        useBorderWithImage?: boolean;
      };
      size?: number;
      title?: string;
      value?: number;
      widthConstraint?: number | {
        maximum?: number;
      };
      x?: number;
      y?: number;
    };
    manipulation?: {
      enabled?: boolean;
      initiallyActive?: boolean;
      addNode?: boolean | Function;
      addEdge?: boolean | Function;
      editNode?: boolean | Function;
      editEdge?: boolean | Function;
      deleteNode?: boolean | Function;
      deleteEdge?: boolean | Function;
      controlNodeStyle?: any;
    };
    interaction?: {
      dragNodes?: boolean;
      dragView?: boolean;
      hideEdgesOnDrag?: boolean;
      hideEdgesOnZoom?: boolean;
      hideNodesOnDrag?: boolean;
      hover?: boolean;
      hoverConnectedEdges?: boolean;
      keyboard?: {
        enabled?: boolean;
        speed?: {
          x?: number;
          y?: number;
          zoom?: number;
        };
        bindToWindow?: boolean;
      } | boolean;
      multiselect?: boolean;
      navigationButtons?: boolean;
      selectable?: boolean;
      selectConnectedEdges?: boolean;
      tooltipDelay?: number;
      zoomView?: boolean;
      zoomSpeed?: number;
    };
    physics?: {
      enabled?: boolean;
      barnesHut?: {
        gravitationalConstant?: number;
        centralGravity?: number;
        springLength?: number;
        springConstant?: number;
        damping?: number;
        avoidOverlap?: number;
      };
      forceAtlas2Based?: {
        gravitationalConstant?: number;
        centralGravity?: number;
        springLength?: number;
        springConstant?: number;
        damping?: number;
        avoidOverlap?: number;
      };
      repulsion?: {
        centralGravity?: number;
        springLength?: number;
        springConstant?: number;
        nodeDistance?: number;
        damping?: number;
      };
      hierarchicalRepulsion?: {
        centralGravity?: number;
        springLength?: number;
        springConstant?: number;
        nodeDistance?: number;
        damping?: number;
      };
      maxVelocity?: number;
      minVelocity?: number;
      solver?: string;
      stabilization?: {
        enabled?: boolean;
        iterations?: number;
        updateInterval?: number;
        onlyDynamicEdges?: boolean;
        fit?: boolean;
      };
      timestep?: number;
      adaptiveTimestep?: boolean;
      wind?: {
        x?: number;
        y?: number;
      };
    };
  }

  export interface Events {
    [event: string]: (params?: any) => void;
  }

  export interface Network {
    destroy(): void;
    setData(data: GraphData): void;
    setOptions(options: Options): void;
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
    once(event: string, callback: Function): void;
    canvasToDOM(position: {x: number, y: number}): {x: number, y: number};
    DOMtoCanvas(position: {x: number, y: number}): {x: number, y: number};
    redraw(): void;
    setSize(width: string, height: string): void;
    cluster(options?: any): void;
    clusterByConnection(nodeId: string, options?: any): void;
    clusterByHubsize(hubsize?: number, options?: any): void;
    clusterOutliers(options?: any): void;
    findNode(nodeId: string): Node[];
    getClusteredEdges(baseEdgeId: string): Edge[];
    getBaseEdge(clusteredEdgeId: string): Edge;
    getBaseEdges(clusteredEdgeId: string): Edge[];
    updateEdge(startEdgeId: string, options?: any): void;
    updateClusteredNode(clusteredNodeId: string, options?: any): void;
    getNodesInCluster(clusteredNodeId: string): string[];
    openCluster(clusteredNodeId: string, options?: any): void;
    getSeed(): number;
    enableEditMode(): void;
    disableEditMode(): void;
    addNodeMode(): void;
    editNode(): void;
    addEdgeMode(): void;
    editEdgeMode(): void;
    deleteSelected(): void;
    getPositions(nodeIds?: string[]): {[nodeId: string]: {x: number, y: number}};
    storePositions(): void;
    moveNode(nodeId: string, x: number, y: number): void;
    fit(options?: {nodes?: string[], animation?: boolean | {duration: number, easingFunction: string}}): void;
    focus(nodeId: string, options?: {scale?: number, animation?: boolean | {duration: number, easingFunction: string}}): void;
    stabilize(iterations?: number): void;
    getSelection(): {nodes: string[], edges: string[]};
    getSelectedNodes(): string[];
    getSelectedEdges(): string[];
    getNodeAt(position: {x: number, y: number}): string;
    getEdgeAt(position: {x: number, y: number}): string;
    selectNodes(nodeIds: string[], highlightEdges?: boolean): void;
    selectEdges(edgeIds: string[]): void;
    setSelection(selection: {nodes: string[], edges: string[]}, options?: {unselectAll?: boolean, highlightEdges?: boolean}): void;
    unselectAll(): void;
    getScale(): number;
    getViewPosition(): {x: number, y: number};
    moveTo(options: {position: {x: number, y: number}, scale?: number, animation?: boolean | {duration: number, easingFunction: string}}): void;
    releaseNode(): void;
    getOptionsFromConfigurator(): any;
  }

  export interface NetworkEvents {
    click: string;
    doubleClick: string;
    oncontext: string;
    hold: string;
    release: string;
    select: string;
    selectNode: string;
    selectEdge: string;
    deselectNode: string;
    deselectEdge: string;
    dragStart: string;
    dragging: string;
    dragEnd: string;
    hoverNode: string;
    blurNode: string;
    hoverEdge: string;
    blurEdge: string;
    zoom: string;
    showPopup: string;
    hidePopup: string;
    startStabilizing: string;
    stabilizationProgress: string;
    stabilizationIterationsDone: string;
    stabilized: string;
    resize: string;
    initRedraw: string;
    beforeDrawing: string;
    afterDrawing: string;
    animationFinished: string;
    configChange: string;
  }

  // Enhanced event parameter types
  export interface ClickEvent {
    pointer: {
      DOM: { x: number, y: number };
      canvas: { x: number, y: number };
    };
    nodes: string[];
    edges: string[];
    event: any;
    items: any[];
  }

  export interface SelectEvent {
    nodes: string[];
    edges: string[];
    event: any;
    pointer: {
      DOM: { x: number, y: number };
      canvas: { x: number, y: number };
    };
  }

  export interface HoverEvent {
    node: string;
    edge: string;
    pointer: {
      DOM: { x: number, y: number };
      canvas: { x: number, y: number };
    };
  }

  export interface DragEvent {
    nodes: string[];
    event: any;
    pointer: {
      DOM: { x: number, y: number };
      canvas: { x: number, y: number };
    };
  }

  export interface ZoomEvent {
    direction: string;
    scale: number;
    pointer: {
      DOM: { x: number, y: number };
      canvas: { x: number, y: number };
    };
  }

  export interface StabilizationEvent {
    iterations: number;
  }

  export interface GraphEvents {
    click?(params: ClickEvent): void;
    doubleClick?(params: ClickEvent): void;
    oncontext?(params: ClickEvent): void;
    hold?(params: ClickEvent): void;
    release?(params: ClickEvent): void;
    select?(params: SelectEvent): void;
    selectNode?(params: SelectEvent): void;
    selectEdge?(params: SelectEvent): void;
    deselectNode?(params: SelectEvent): void;
    deselectEdge?(params: SelectEvent): void;
    dragStart?(params: DragEvent): void;
    dragging?(params: DragEvent): void;
    dragEnd?(params: DragEvent): void;
    hoverNode?(params: HoverEvent): void;
    blurNode?(params: HoverEvent): void;
    hoverEdge?(params: HoverEvent): void;
    blurEdge?(params: HoverEvent): void;
    zoom?(params: ZoomEvent): void;
    showPopup?(params: any): void;
    hidePopup?(params: any): void;
    startStabilizing?(params: any): void;
    stabilizationProgress?(params: StabilizationEvent): void;
    stabilizationIterationsDone?(params: any): void;
    stabilized?(params: any): void;
    resize?(params: any): void;
    initRedraw?(params: any): void;
    beforeDrawing?(params: any): void;
    afterDrawing?(params: any): void;
    animationFinished?(params: any): void;
    configChange?(params: any): void;
  }

  export type GraphEventsKey = keyof GraphEvents;

  export interface GraphComponentProps {
    graph: GraphData;
    options?: Options;
    events?: GraphEvents;
    style?: React.CSSProperties;
    getNetwork?: (network: Network) => void;
    getNodes?: (nodes: any) => void;
    getEdges?: (edges: any) => void;
  }

  export default class Graph extends Component<GraphComponentProps> {
    constructor(props: GraphComponentProps);
    render(): JSX.Element;
  }
}
