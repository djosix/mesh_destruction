import * as THREE from 'three';

THREE.Geometry.prototype.setNeedUpdate = function () {
  this.verticesNeedUpdate = true;
  this.elementsNeedUpdate = true;
  this.morphTargetsNeedUpdate = true;
  this.uvsNeedUpdate = true;
  this.normalsNeedUpdate = true;
  this.colorsNeedUpdate = true;
  this.tangentsNeedUpdate = true;
};

export class Program {
  constructor(scene, mesh, params) {
    this.scene = scene
    this.mesh = mesh;
    this.params = params;

    this.age = 0;
    this.fragLastVisitAge = 0;

    this.frag = new THREE.Object3D();
    this.queue = [];

    this.init();
  }

  init() {
    this.scene.add(this.mesh);
    this.scene.add(this.frag);

    let edgeFaces = {};
    let edgeToKey = ij => `e:${Math.min(...ij)}:${Math.max(...ij)}`;

    // Set face._edges and edgeFaces
    for (let face of this.mesh.geometry.faces) {
      face._edges = [
        [face.a, face.b],
        [face.b, face.c],
        [face.c, face.a]
      ].map(edgeToKey);
      for (let edge of face._edges) {
        if (!edgeFaces[edge]) edgeFaces[edge] = [];
        edgeFaces[edge].push(face);
      }
    }

    // Set face._neighbors from face._edges and edgeFaces
    for (let face of this.mesh.geometry.faces) {
      face._neighbors = [];
      for (let edge of face._edges) {
        for (let neighbor of edgeFaces[edge]) {
          if (face != neighbor) {
            face._neighbors.push(neighbor);
          }
        }
      }
    }
  }

  start() {
    if (this.queue.length == 0 && this.mesh.geometry.faces.length > 0) {
      this.running = true;
      // Pick a face and add to queue
      this.queue.push(this.mesh.geometry.faces[0]);
    }
  }

  add(v0, v1, v2) {
    let frag = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial());
    let center = new THREE.Vector3(0, 0, 0).add(v0).add(v1).add(v2).divideScalar(3);

    frag.position.copy(this.mesh.position);
    frag.position.add(center);
    frag.rotation.copy(this.mesh.rotation);

    // Set geometry
    frag.geometry.vertices.push(v0.clone().sub(center));
    frag.geometry.vertices.push(v1.clone().sub(center));
    frag.geometry.vertices.push(v2.clone().sub(center));
    frag.geometry.faces.push(new THREE.Face3(0, 1, 2));
    frag.geometry.computeFaceNormals();

    // Set material
    frag.material.side = THREE.DoubleSide;
    frag.material.color.setRGB(
      this.params.fragColorR,
      this.params.fragColorG,
      this.params.fragColorB,
    );
    frag.material.transparent = true;
    frag.material.opacity = 1.0;

    let rand = () => Math.random() - 0.5;
    frag._data = {
      age: 0,
      velocity: frag.geometry.faces[0].normal.clone()
        .add(new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(0.3))
        .multiplyScalar(this.params.fragVelScale),
      rotAxis: new THREE.Vector3(rand(), rand(), rand()).normalize(),
      rotSpeed: rand() * 2 * Math.PI * this.params.fragRotScale,
    };

    this.frag.add(frag);
  }

  update(delta) {
    if (!this.running) return;

    this.age += delta;

    if (this.queue.length > 0) {
      // Check wether fragments BFS should step
      if (this.age - this.fragLastVisitAge >= this.params.fragVisitInt) {
        let nextQueue = [];

        for (let face of this.queue) {
          if (face._visited)
            continue;
          else
            face._visited = true;

          for (let neighbor of face._neighbors)
            nextQueue.push(neighbor);

          // Add a face to frags
          this.add(...[face.a, face.b, face.c].map(v => this.mesh.geometry.vertices[v]));
        }

        this.mesh.geometry.faces = this.mesh.geometry.faces.filter(face => !face._visited);
        this.mesh.geometry.setNeedUpdate();

        this.fragLastVisitAge = this.age;
        this.queue = nextQueue;
      }
    }

    this.frag.children = this.frag.children.filter(frag => {
      // Skip if it is not a frag
      if (frag._data === undefined) {
        return true;
      }

      frag._data.age += delta;

      // Remove child if it is old enough
      if (frag._data.age > this.params.fragMaxAge) {
        return false;
      }

      // Move and rotate
      frag.position.add(frag._data.velocity.clone().multiplyScalar(delta));
      frag.rotateOnAxis(frag._data.rotAxis, frag._data.rotSpeed * delta);

      // Decay
      frag._data.velocity.multiplyScalar(this.params.fragDecayScale);
      frag._data.rotSpeed *= this.params.fragDecayScale

      // Update alpha
      let opacityRatio = frag._data.age / this.params.fragMaxAge;

      frag.material.opacity = 1 - Math.pow(opacityRatio, this.params.fragAlphaPowScale);
      frag.material.needsUpdate = true;

      return true;
    });
  }

  clean() {
    this.scene.children = [];
  }
}