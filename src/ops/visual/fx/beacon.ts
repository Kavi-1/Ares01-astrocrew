import * as THREE from 'three';
import { visualConfig } from '../config/visualConfig';

export function createBeaconColumn() {
  const { heightM, radiusM } = visualConfig.beacon;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vWorld; varying float vHeight;
      void main(){ vec4 world=modelMatrix*vec4(position,1.0); vWorld=world.xyz; vHeight=uv.y; gl_Position=projectionMatrix*viewMatrix*world; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vWorld; varying float vHeight;
      void main(){ float edge=smoothstep(0.0,0.16,vHeight)*(1.0-smoothstep(0.76,1.0,vHeight)); float distanceFade=1.0-smoothstep(60.0,420.0,length(cameraPosition-vWorld)); float alpha=edge*distanceFade*0.21; gl_FragColor=vec4(uColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    uniforms: { uColor: { value: new THREE.Color('#5cebf3') } },
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusM, radiusM, heightM, 16, 1, true), material);
  mesh.position.y = heightM / 2; mesh.name = 'VisualV2_Soft_Science_Beacon'; return mesh;
}
