class Game {
    constructor() {
        this.root = document.getElementById('container');
        this.container = document.getElementById('game');
        this.scoreEl = document.getElementById('score');
        this.instructions = document.getElementById('instructions');

        this.blockHeight = 2;
        this.startSize = 10;
        this.range = 12;
        this.tolerance = 0.3;

        this.blocks = [];
        this.pieces = [];
        this.current = null;
        this.top = null;
        this.level = 0;
        this.score = 0;
        this.cameraY = 0;
        this.cameraTargetY = 0;
        this.endTime = 0;
        this.state = 'ready';
        this.geometry = new THREE.BoxGeometry(1, 1, 1);

        // renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        let ratio = window.devicePixelRatio;
        if (ratio > 2) {
            ratio = 2;
        }
        this.renderer.setPixelRatio(ratio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor('#D0CBC7', 1);
        this.container.appendChild(this.renderer.domElement);
        // scene
        this.scene = new THREE.Scene();
        // camera
        let aspect = window.innerWidth / window.innerHeight;
        let d = 20;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -100, 1000);
        this.camera.position.x = 2;
        this.camera.position.y = 2;
        this.camera.position.z = 2;
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        //light
        this.light = new THREE.DirectionalLight(0xffffff, 0.5);
        this.light.position.set(0, 499, 0);
        this.scene.add(this.light);
        this.softLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.softLight);

        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.onResize(), 300);
        });
        window.addEventListener('pointerdown', () => this.onAction());
        window.addEventListener('keydown', (e) => {
            if (e.code == 'Space') {
                e.preventDefault();
                if (!e.repeat) {
                    this.onAction();
                }
            }
        });
        // zapret zuma shchepkom na iPhone
        document.addEventListener('gesturestart', (e) => e.preventDefault());

        // na telefone pishem "Tap" vmesto "Click"
        if ('ontouchstart' in window) {
            this.instructions.innerHTML = 'Tap to place the block';
            let texts = document.querySelectorAll('.game-over p');
            texts[1].innerHTML = 'Tap to start again';
        }

        this.onResize();
        this.setState('ready');
        this.reset();

        this.lastTime = performance.now();
        this.tick();
    }

    onResize() {
        let w = window.innerWidth;
        let h = window.innerHeight;
        let aspect = w / h;
        let d = 20;
        // uzkiy ekran (telefon vertikalno): vpisyvaem po shirine
        if (aspect < 0.9) {
            d = 18 / aspect;
        }
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    setState(state) {
        this.state = state;
        this.root.className = state;
    }

    getColor(level) {
        let hue = ((level * 6 + 200) % 360) / 360;
        let color = new THREE.Color();
        color.setHSL(hue, 0.55, 0.6);
        return color;
    }

    makeBlock(w, h, d, x, y, z, color) {
        let material = new THREE.MeshLambertMaterial({ color: color });
        let mesh = new THREE.Mesh(this.geometry, material);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        return mesh;
    }

    reset() {
        for (let i = 0; i < this.blocks.length; i++) {
            this.scene.remove(this.blocks[i]);
        }
        for (let i = 0; i < this.pieces.length; i++) {
            this.scene.remove(this.pieces[i].mesh);
        }
        if (this.current) {
            this.scene.remove(this.current.mesh);
        }
        this.blocks = [];
        this.pieces = [];
        this.current = null;
        this.level = 0;
        this.score = 0;
        this.scoreEl.innerHTML = '0';
        this.instructions.style.opacity = '';
        this.cameraY = 0;
        this.cameraTargetY = 0;

        // osnovanie bashni
        let baseHeight = 30;
        let baseY = this.blockHeight / 2 - baseHeight / 2;
        let base = this.makeBlock(this.startSize, baseHeight, this.startSize, 0, baseY, 0, this.getColor(0));
        this.blocks.push(base);

        this.top = { x: 0, z: 0, w: this.startSize, d: this.startSize };
        this.spawn();
    }

    spawn() {
        this.level += 1;
        let axis = 'z';
        if (this.level % 2 == 1) {
            axis = 'x';
        }
        let y = this.level * this.blockHeight;
        let x = this.top.x;
        let z = this.top.z;
        if (axis == 'x') {
            x = this.top.x - this.range;
        } else {
            z = this.top.z - this.range;
        }
        let mesh = this.makeBlock(this.top.w, this.blockHeight, this.top.d, x, y, z, this.getColor(this.level));
        this.current = { mesh: mesh, axis: axis, dir: 1 };
        this.cameraTargetY = (this.level - 1) * this.blockHeight;
    }

    onAction() {
        if (this.state == 'ready') {
            this.setState('playing');
        } else if (this.state == 'playing') {
            this.place();
        } else if (this.state == 'ended') {
            if (performance.now() - this.endTime > 600) {
                this.reset();
                this.setState('playing');
            }
        }
    }

    place() {
        let cur = this.current;
        let axis = cur.axis;
        let size = this.top.d;
        if (axis == 'x') {
            size = this.top.w;
        }
        let prevPos = this.top[axis];
        let curPos = cur.mesh.position[axis];
        let delta = curPos - prevPos;
        let overlap = size - Math.abs(delta);

        // promakh: blok padaet, igra okonchena
        if (overlap <= 0) {
            this.pieces.push({ mesh: cur.mesh, vy: 0, rot: 1.5 });
            this.current = null;
            this.setState('ended');
            this.endTime = performance.now();
            return;
        }

        let newSize = overlap;
        let newPos = prevPos + delta / 2;

        if (Math.abs(delta) < this.tolerance) {
            // pochti idealno: ravnyaem blok
            newSize = size;
            newPos = prevPos;
        } else {
            // otrezaem lishnee i puskaem padat
            let cutSize = Math.abs(delta);
            let sign = 1;
            if (delta < 0) {
                sign = -1;
            }
            let cutPos = prevPos + sign * (size + cutSize) / 2;
            let y = cur.mesh.position.y;
            let color = cur.mesh.material.color;
            let cutMesh = null;
            if (axis == 'x') {
                cutMesh = this.makeBlock(cutSize, this.blockHeight, this.top.d, cutPos, y, this.top.z, color);
            } else {
                cutMesh = this.makeBlock(this.top.w, this.blockHeight, cutSize, this.top.x, y, cutPos, color);
            }
            this.pieces.push({ mesh: cutMesh, vy: 0, rot: sign * 1.5 });
        }

        // obnovlyaem tekushiy blok
        cur.mesh.position[axis] = newPos;
        cur.mesh.scale[axis] = newSize;
        this.top[axis] = newPos;
        if (axis == 'x') {
            this.top.w = newSize;
        } else {
            this.top.d = newSize;
        }

        this.blocks.push(cur.mesh);
        this.score += 1;
        this.scoreEl.innerHTML = this.score;
        this.instructions.style.opacity = 0;
        this.spawn();
    }

    update(dt) {
        // dvizhenie tekushego bloka
        if (this.state == 'playing' && this.current) {
            let speed = 8 + this.score * 0.35;
            if (speed > 20) {
                speed = 20;
            }
            let axis = this.current.axis;
            let center = this.top[axis];
            let pos = this.current.mesh.position[axis];
            pos += this.current.dir * speed * dt;
            if (pos > center + this.range) {
                pos = center + this.range;
                this.current.dir = -1;
            }
            if (pos < center - this.range) {
                pos = center - this.range;
                this.current.dir = 1;
            }
            this.current.mesh.position[axis] = pos;
        }

        // padayushie kuski
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            let p = this.pieces[i];
            p.vy -= 60 * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.rotation.x += p.rot * dt;
            p.mesh.rotation.z += p.rot * dt;
            if (p.mesh.position.y < this.cameraY - 60) {
                this.scene.remove(p.mesh);
                this.pieces.splice(i, 1);
            }
        }

        // plavnoe dvizhenie kamery vverkh
        this.cameraY += (this.cameraTargetY - this.cameraY) * Math.min(1, dt * 4);
        this.camera.position.y = 2 + this.cameraY;
        this.camera.lookAt(new THREE.Vector3(0, this.cameraY, 0));
    }

    tick() {
        let now = performance.now();
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dt > 0.05) {
            dt = 0.05;
        }
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.tick());
    }
}

new Game();