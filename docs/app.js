import * as THREE from './libs/three125/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { ARButton } from './libs/ARButton.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { ControllerGestures } from './libs/ControllerGestures.js';



class App{
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild( container );
        
        this.loadingBar = new LoadingBar();
        this.loadingBar.visible = false;

		this.assetsPath = './assets/ar-shop/';
        
		this.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 20 );
		this.camera.position.set( 0, 0, 0 );
        
		this.scene = new THREE.Scene();

		const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        ambient.position.set( 0.5, 1, 0.25 );
		this.scene.add(ambient);
			
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
		container.appendChild( this.renderer.domElement );
        this.setEnvironment();
        
        this.reticle = new THREE.Mesh(
            new THREE.TorusGeometry( 0.10,0.005, 20, 32 ).rotateX(  Math.PI / 2 ),
            new THREE.MeshBasicMaterial({ color: 0x66ccff })
        );
        
        this.reticle.matrixAutoUpdate = false;
        
        this.reticle.visible = false;
        this.scene.add( this.reticle );
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.target.set(0, 3.5, 0);
        this.controls.update();

        this.origin = new THREE.Vector3();
        this.euler = new THREE.Euler();
        this.quaternion = new THREE.Quaternion();
        
        this.setupXR();
		
		window.addEventListener('resize', this.resize.bind(this) );
        
	}

    
    
    
    setupXR(){
        this.renderer.xr.enabled = true;
        
        //TO DO 1: If navigator includes xr and immersive-ar is supported then show the ar-button class
        if ('xr' in navigator) {
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if(supported) {
                    const collection = document.getElementsByClassName('ar-button');
                    [...collection].forEach( el => {
                        el.style.display = 'block';
                    })
                }
            })
        }
        
        const self = this;
        let controller, controller1;

        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
        
        function onSelect() {
            if (self.painting===undefined) return;
            
            if (self.reticle.visible){

                const reticleQuaternion = new THREE.Quaternion();
                self.reticle.getWorldQuaternion(reticleQuaternion);

                self.painting.quaternion.copy(reticleQuaternion);
                self.painting.updateMatrix();
                const axesHelper = new THREE.AxesHelper( 1 );
                // self.painting.add( axesHelper );
                self.painting.position.setFromMatrixPosition( self.reticle.matrix );
                self.painting.visible = true;
                self.painting.updateMatrix();

            }
            
        }

        this.controller = this.renderer.xr.getController( 0 );
        this.controller.addEventListener( 'select', onSelect );
        
        this.scene.add( this.controller );

        this.gestures = new ControllerGestures( this.renderer );
        this.gestures.addEventListener( 'pan', (ev)=>{
            // console.log( ev );
            if (ev.initialise !== undefined){
                self.startPosition = self.painting.position.clone();
            }else{
                const pos = self.startPosition.clone().add( ev.delta.multiplyScalar(6) );
                self.painting.position.copy( pos );
                self.painting.updateMatrix();
            } 
        });
        this.gestures.addEventListener( 'pinch', (ev)=>{
            //console.log( ev );  
            if (ev.initialise !== undefined){
                self.startScale = self.painting.scale.clone();
            }else{
                const scale = self.startScale.clone().multiplyScalar(ev.scale);
                self.painting.scale.copy( scale );
            }
        });
        this.gestures.addEventListener( 'rotate', (ev)=>{
            //      console.log( ev ); 
            if (ev.initialise !== undefined){
                self.startQuaternion = self.painting.quaternion.clone();
            }else{
                self.painting.quaternion.copy( self.startQuaternion );
                self.painting.children[0].rotation.y = ev.theta;
                self.painting.updateMatrix();
            }
        });
        this.renderer.setAnimationLoop( this.render.bind(this) );

    }
	
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
    	this.camera.updateProjectionMatrix();
    	this.renderer.setSize( window.innerWidth, window.innerHeight ); 
    }
    
    setEnvironment(){
        const loader = new RGBELoader().setDataType( THREE.UnsignedByteType );
        const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
        pmremGenerator.compileEquirectangularShader();
        
        const self = this;
        
        loader.load( './assets/hdr/venice_sunset_1k.hdr', ( texture ) => {
          const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
          pmremGenerator.dispose();

          self.scene.environment = envMap;

        }, undefined, (err)=>{
            console.error( 'An error occurred setting the environment');
        } );
    }
    
	showPainting(painting){
        this.initAR();
        
		const loader = new GLTFLoader( ).setPath(this.assetsPath);
        const self = this;
        
        this.loadingBar.visible = true;
		
		// Load a glTF resource
		loader.load(
			// resource URL
			`${painting}.glb`,
			// called when the resource is loaded
			function ( gltf ) {

				self.scene.add( gltf.scene );
                self.painting = gltf.scene;
        
                self.painting.visible = false; 
                
                self.loadingBar.visible = false;


                
                self.renderer.setAnimationLoop( self.render.bind(self) );
			},
			// called while loading is progressing
			function ( xhr ) {

				self.loadingBar.progress = (xhr.loaded / xhr.total);
				
			},
			// called when loading has errors
			function ( error ) {

				console.log( 'An error happened' );

			}
		);
	}			
    
    initAR(){
        
        //TO DO 2: Start an AR session
        let currentSession = null;
        const self = this;
        const axesHelper = new THREE.AxesHelper( 1 );
        // self.scene.add( axesHelper );
        const sessionInit = { requiredFeatures: ['hit-test']};

        function onSessionStarted(session) {
            session.addEventListener('end', onSessionEnded);

            self.renderer.xr.setReferenceSpaceType('local');
            self.renderer.xr.setSession (session);

            currentSession = session
        }

        function onSessionEnded (session) {
            currentSession.addEventListener('end', onSessionEnded);

            currentSession = null;

            if (self.painting !== null) {
                self.scene.remove( self.painting) ;
                self.painting = null;
            }

            self.renderer.setAnimationLoop( null)
        }

        if (currentSession === null) {
            navigator.xr.requestSession( 'immersive-ar', sessionInit).then( (session) => onSessionStarted(session));

        } else {

            currentSession.end()
        }
    }
    
    requestHitTestSource(){
        const self = this;
        
        const session = this.renderer.xr.getSession();

        session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {
            
            session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {

                self.hitTestSource = source;

            } );

        } );

        

        session.addEventListener( 'end', function () {

            self.hitTestSourceRequested = false;
            self.hitTestSource = null;
            self.referenceSpace = null;

        } );

        this.hitTestSourceRequested = true;

    }
    
    getHitTestResults( frame ){

        
        
        const hitTestResults = frame.getHitTestResults( this.hitTestSource );

        

            if ( hitTestResults.length  ) {
                
                let  referenceSpace = this.renderer.xr.getReferenceSpace();
                let  hit = hitTestResults[ 0 ];
                let  pose = hit.getPose( referenceSpace );
                
                this.reticle.visible = true;
                
                let axesHelper = new THREE.AxesHelper( 0.2 );
                this.reticle.add(axesHelper)
                this.reticle.matrix.fromArray(pose.transform.matrix );

            } else {

                this.reticle.visible = false;

            }

    }

    
	render( timestamp, frame ) {

        if ( frame ) {
            if ( this.renderer.xr.isPresenting ){
                this.gestures.update();
                
            }
            if ( this.hitTestSourceRequested === false ) this.requestHitTestSource( )

            if ( this.hitTestSource ) this.getHitTestResults( frame );
        }

        this.renderer.render( this.scene, this.camera );

    }
}

export { App };