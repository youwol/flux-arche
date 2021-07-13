import { uuidv4 } from '@youwol/flux-core'
import { ImmutableTree } from '@youwol/fv-tree'
import { DataFrame } from '@youwol/dataframe'
import { Interfaces } from '@youwol/flux-files'

import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { ArcheFacade } from '../arche.facades'
import { arche } from '../main'
import { KeplerMesh } from '@youwol/flux-kepler'

export enum ProcessingType {
    Solve,
    Resolve
}


export class ArcheNode extends ImmutableTree.Node {

    nodeType = "ArcheNode"
    signals$ = new ReplaySubject<any>()
    name: string
    
    type: Array<string>
    ownerId : string

    constructor( { id, ownerId, name, type, children} : 
                 {id?:string, ownerId: string, name:string, type:Array<string>, children?:Array<ArcheNode>}){
        super({id:id ? id :uuidv4(), children})
        this.name = name
        this.type = type || []
        this.ownerId = ownerId
    }
    
    /*data(){
        let children = this.children as Array<ArcheNode>
        return {id: this.id, ownerId:this.ownerId, name:this.name, type:this.type, children: this.children ? children.map( c => c.data()): undefined,
                nodeType:this.nodeType}
    }*/
}

export class RootArcheNode extends ArcheNode{

    nodeType = "RootArcheNode"

    folders : Object
    process$ = new BehaviorSubject<{type,count}>({type:'none',count:0})
    processes$ : Observable<{count:number}>

    constructor( { id, ownerId, name, type, children, folders, parameters } :
        { id: string, ownerId: string, name: string, type: Array<string>, children: Array<ArcheNode>, folders: any, 
            parameters?:  { poisson: number, young: number, density: number } } ){

        super({ id, ownerId, name, type, children})
        this.processes$ = this.process$.pipe( 
            //filter( s => s.type && s.type == ProcessingType.Solve),
            scan( (acc:{count:number},e:{type:string, count: number}) =>  ({count:acc.count+e.count}), {count:0} )
        )
        this.folders = folders
    }

    /*data(){
        return Object.assign({}, super.data(), {folders: this.folders})
    }*/
}


export class ArcheMaterialNode extends ArcheNode{

    nodeType = "ArcheMaterialNode"
    parameters = { poisson: 0, young: 0, density: 0 }

    constructor( { id, ownerId, name, type, parameters } :
        { id: string, ownerId: string, name: string, type: Array<string>,
            parameters?:  { poisson: number, young: number, density: number } } ){

        super({  id, ownerId, name, type, children:undefined})
        this.parameters = parameters || this.parameters
    }

    /*data(){
        return Object.assign({}, super.data(), {parameters:this.parameters})
    }*/
}

export class ArcheFolderNode extends ArcheNode {

    nodeType = "ArcheFolderNode"

    constructor( { id, ownerId, name, type, children} ){ super({  id, ownerId, name, type, children})}
}

export class ArcheFileNode extends ArcheNode {

    nodeType = "ArcheFileNode"
    fileId : string

    constructor( { id, ownerId, name, type, fileId, children} ){ 
        super({ id, ownerId, name, type, children})
        this.fileId = fileId
    }
    /*data(){
        return Object.assign({}, super.data(), {fileId: this.fileId})
    }*/
}
export class ArcheFolderDiscontinuityNode extends ArcheFolderNode {

    nodeType = "ArcheFolderDiscontinuityNode"
    
    constructor( { id, ownerId, name, type, children} ){ super({ id, ownerId, name, type, children}) }
}

export class ArcheDiscontinuityNode extends ArcheFolderNode {

    nodeType = "ArcheDiscontinuityNode"
    fileId : string
    
    constructor( { id, ownerId, name, type, children} ){ super({ id, ownerId, name, type, children})}
}

export class ArcheMeshNode extends ArcheFileNode {

    nodeType = "ArcheMeshNode"
    fileId : string
    
    boundingBox: {min:{x,y,z}, max:{x,y,z}} 

    constructor( { id, ownerId, name, fileId, boundingBox, children} : {id:string, ownerId: string,name:string, fileId:string, children
    boundingBox:{min:{x,y,z}, max:{x,y,z}} }){ 
        super({ id, ownerId, name, type:["mesh"], fileId, children})
        this.boundingBox = boundingBox
    }
    /*data(){
        return Object.assign({}, super.data(), {boundingBox: this.boundingBox})
    }*/
}

export class ArcheDiscontinuityMeshNode extends ArcheMeshNode{

    nodeType = "ArcheDiscontinuityMeshNode"

    constructor( { id, ownerId, name, fileId, boundingBox} : {id:string, ownerId: string,name:string, fileId:string, 
            boundingBox:{min:{x,y,z}, max:{x,y,z}} }){ 
        super({ id, ownerId, name, fileId, boundingBox , children:undefined})
        this.boundingBox = boundingBox
    }
}

export class ArcheObservationMeshNode extends ArcheMeshNode{

    nodeType = "ArcheObservationMeshNode"
    processes$ : Observable<{count:number, ids: Array<string>}>

    constructor( { id, ownerId, name, fileId, boundingBox, children} : {id:string, ownerId: string,name:string, fileId:string, children?: Array<ArcheRealizationNode>,
            boundingBox:{min:{x,y,z}, max:{x,y,z}} }){ 
        super({ id, ownerId, name, fileId, boundingBox, children : children || [] })
        this.boundingBox = boundingBox
        
        this.processes$ = this.signals$.pipe( 
            filter( s => s.type && s.type == ProcessingType.Resolve),
            scan( (acc:{count:number, ids:Array<string>},e:{type:string, id: string, count: number}) =>  
                ({count:acc.count+e.count,ids:acc.ids.concat([e.id])}), 
                {count:0, ids:[]} )
        )
    }
}

type Field = string | ((x,y,z)=>number)

export class ArcheBoundaryConditionNode extends ArcheNode {

    nodeType = "ArcheBoundaryConditionNode"

    parameters : { dipAxis: { type:string, field: Field}, 
                   strikeAxis:  { type:string, field: Field}, 
                   normalAxis:  { type:string, field: Field} }

    constructor( { id, ownerId, name, parameters} : 
        { id: string, ownerId: string, name: string, parameters?: { 
            dipAxis: { type:string, field: Field}, 
            strikeAxis:  { type:string, field: Field},
            normalAxis:  { type:string, field: Field} }} ){ 
        super({ id, ownerId, name, type:['boundary-condition'], children:undefined})
        
        this.parameters = parameters || { 
            dipAxis: { type:'locked', field: (x,y,z) => 0}, 
            strikeAxis:  { type:'locked', field: (x,y,z) => 0}, 
            normalAxis:  { type:'locked', field: (x,y,z) => 0} 
        }
    }
    /*data(){
        return Object.assign({}, super.data(), {parameters:this.parameters})
    }*/
}

export class ArcheFolderObservationNode extends ArcheFolderNode {

    nodeType = "ArcheFolderObservationNode"
    
    constructor( { id, ownerId, name, type, children} ){ super({ id, ownerId, name, type, children}) }
}

export class ArcheObservationNode extends ArcheNode {

    nodeType = "ArcheObservationNode"

    constructor( { id, ownerId, name, type, children} ){ 
        super({ id, ownerId, name, type, children})
    }
}

export class ArchePlaneObservationNode extends ArcheObservationNode {

    nodeType = "ArchePlaneObservationNode"
    constructor( { id, ownerId, name, type, children} ){ super({ id, ownerId, name, type, children})}
}

export class ArcheFolderRemoteNode extends ArcheFolderNode {

    nodeType = "ArcheFolderRemoteNode"
    
    constructor( { id, ownerId, name, type, children} ){ super({ id, ownerId, name, type, children}) }
}

export abstract class ArcheRemoteNode extends ArcheNode {

    nodeType = "ArcheRemoteNode"

    parameters : any

    constructor( { id, ownerId, name, type, parameters} ){ super({ id, ownerId, name, type})
        this.parameters = parameters
    }

    /*data(){
        return Object.assign({}, super.data(), {parameters:this.parameters})
    }*/
}

export class ArcheAndersonianRemoteNode extends ArcheRemoteNode {

    nodeType = "ArcheAndersonianRemoteNode"
    ArcheFacade = ArcheFacade.AndersonianRemote

    constructor( { id, ownerId, name, type, parameters} :
        {id: string, ownerId: string, name: string, type?: Array<string>,
         parameters?: {HSigma: number, hSigma: number, vSigma: number, theta: number} }
         ){ super({ id, ownerId, name, type: type, parameters: parameters || {HSigma: 0, hSigma: 0, vSigma: 0, theta: 0}})
    }
}

export abstract class ArcheConstraintNode extends ArcheNode {

    nodeType = "ArcheConstraintNode"
    public readonly parameters : {[key:string]: any}

    constructor( { id, ownerId, name, parameters } ){ 
        super({  id, ownerId, name, type:['constraint'], children:undefined})
        this.parameters = parameters }

    /*data(){
        return Object.assign({}, super.data(), {parameters:this.parameters})
    }*/

}

export class ArcheCoulombConstraintNode extends ArcheConstraintNode {

    nodeType = "ArcheCoulombConstraintNode"
    ArcheFacade = ArcheFacade.CoulombConstraint
    
    constructor( {  id, ownerId, name, parameters } : { id: string, ownerId: string, name:string, 
        parameters?:{friction: number, cohesion: number}}){ 
        super({ id, ownerId, name, parameters:parameters||{friction: 0, cohesion: 0}})
    }
}

export class ArcheCoulombOrthoConstraintNode extends ArcheConstraintNode {

    nodeType = "ArcheCoulombOrthoConstraintNode"    
    ArcheFacade = ArcheFacade.CoulombOrthoConstraint

    constructor( { id, ownerId, name, parameters } : { id:string, ownerId: string,name:string,
        parameters?:{theta:number,frictionDip: number,frictionStrike: number/*, cohesionDip: number, 
        cohesionStrike:number, lambda:number , stick:boolean*/}}){ 
        super({ id, ownerId, name, parameters:parameters||{theta:0,frictionDip: 0,frictionStrike: 0/*, cohesionDip: 0, cohesionStrike:0, lambda:0 , stick:true*/}})
    }
}

export class ArcheRealizationNode  extends ArcheFileNode {

    nodeType = "ArcheRealizationNode"
    meshFileId: string
    solutionId: string

    keplerObject: KeplerMesh

    constructor( 
        {  id, ownerId, name, fileId , meshFileId, solutionId} :
        { id:string, ownerId: string, name:string, fileId:string, meshFileId: string, solutionId: string}){ 
        super({ id, ownerId, name, fileId, type:'dataframe', children:undefined})
        this.meshFileId = meshFileId
        this.solutionId = solutionId
    }
    /*data(){
        return Object.assign({}, super.data(), {meshFileId:this.meshFileId, solutionId:this.solutionId})
    }*/
}


/*
export function parseProject(data:any) {

    let base = { 
        name: data.name,
        type: data.type,
        id: data.id,
        ownerId: data.ownerId,
        children: data.children ? data.children.map( child => parseProject(child)) : undefined
    }
    if(data.nodeType == "RootArcheNode")
        return new RootArcheNode(Object.assign({}, base , {folders: data.folders,parameters: data.parameters}))

    if(data.nodeType == "ArcheFileNode")
        return new ArcheFileNode(Object.assign({}, base , {fileId: data.fileId}))
        
    if(data.nodeType == "ArcheFolderNode")
        return new ArcheFolderNode(base)
        
    if(data.nodeType == "ArcheFolderDiscontinuityNode")
        return new ArcheFolderDiscontinuityNode(base)

    if(data.nodeType == "ArcheFolderObservationNode")
        return new ArcheFolderObservationNode(base)
    
    if(data.nodeType == "ArcheFolderRemoteNode")
        return new ArcheFolderRemoteNode(base)

    if(data.nodeType == "ArcheDiscontinuityNode")
        return new ArcheDiscontinuityNode(Object.assign({}, base , { children: base.children || []}))

    if(data.nodeType == "ArcheBoundaryConditionNode")
        return new ArcheBoundaryConditionNode(Object.assign({}, base , {parameters: data.parameters}))

    if(data.nodeType == "ArcheDiscontinuityMeshNode")
        return new ArcheDiscontinuityMeshNode(Object.assign({}, base , {fileId: data.fileId, boundingBox: data.boundingBox}))

    if(data.nodeType == "ArcheObservationNode")
        return new ArcheObservationNode(Object.assign({}, base , {fileId: data.fileId}))
    
    if(data.nodeType == "ArcheAndersonianRemoteNode")
        return new ArcheAndersonianRemoteNode(Object.assign({}, base , {parameters: data.parameters}))
    
    if(data.nodeType == "ArcheCoulombConstraintNode")
        return new ArcheCoulombConstraintNode(Object.assign({}, base , {parameters: data.parameters}))

    if(data.nodeType == "ArcheCoulombOrthoConstraintNode")
        return new ArcheCoulombOrthoConstraintNode(Object.assign({}, base , {parameters: data.parameters}))

    
    if(data.nodeType == "ArcheDisplacementConstraintNode")
        return new ArcheDisplacementConstraintNode(Object.assign({}, base , {parameters: data.parameters}))

    if(data.nodeType == "ArcheDisplacementNormConstraintNode")
        return new ArcheDisplacementNormConstraintNode(Object.assign({}, base , {parameters: data.parameters}))
    
    if(data.nodeType == "ArcheRealizationNode")
        return new ArcheRealizationNode (Object.assign({}, base , {fileId: data.fileId, solutionId: data.solutionId, meshFileId:data.meshFileId}))

    return new ArcheNode(base)
    }
*/

/*
export class ArcheDisplacementConstraintNode extends ArcheConstraintNode {

    nodeType = "ArcheDisplacementConstraintNode"
    ArcheFacade = ArcheFacade.DisplacementConstraint
    constructor( { id, ownerId, name, parameters } : {id:string, ownerId: string, name:string,
        parameters?:{axis:string,direction:string, value: number,type:string}}){ 
        super({ id, ownerId, name, parameters:parameters||{axis:'0',direction:'compression', value: 0,type:'max'}})
    }
}

export class ArcheDisplacementNormConstraintNode extends ArcheConstraintNode {

    nodeType = "ArcheDisplacementNormConstraintNode"
    ArcheFacade = ArcheFacade.DisplacementNormConstraint

    constructor( {  id, ownerId, name, parameters } : {id:string, ownerId: string, name:string,
        parameters?:{direction:string, value: number,type:string}}){ 
        super({ id, ownerId, name, parameters:parameters||{value: 0, direction:'compression', type:'max'}})
    }
}
*/
