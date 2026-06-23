/* =====================================================================
   HIVE WORLDS — globe.js
   A real-time WebGL planet: a procedurally textured, lit, rotating sphere
   (continents, ice caps, clouds, night-side city lights, atmosphere rim).
   No textures/files — everything is generated in the fragment shader.
   Exposes Globe.project() so the 2D layer can pin city markers to it.
   Degrades to a 2D fallback (Globe.ok=false) if WebGL is unavailable.
   ===================================================================== */
const Globe = {
  ok: false, gl: null, prog: null, glcv: null,
  buf: null, idx: null, count: 0,
  loc: {}, mvp: new Float32Array(16), model: new Float32Array(16),

  init() {
    this.glcv = document.getElementById("gl");
    if (!this.glcv) return;
    let gl;
    try { gl = this.glcv.getContext("webgl") || this.glcv.getContext("experimental-webgl"); } catch (e) { gl = null; }
    if (!gl) { this.ok = false; return; }
    this.gl = gl;
    const vs = `
      attribute vec3 aPos;
      uniform mat4 uMVP, uModel;
      varying vec3 vWorld;
      void main(){ vWorld = (uModel * vec4(aPos,1.0)).xyz; gl_Position = uMVP * vec4(aPos,1.0); }`;
    const fs = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec3 vWorld;
      uniform vec3 uLand, uOcean, uLight, uCam; uniform float uTime, uSeed;
      float hash(vec3 p){ p=fract(p*0.3183099+vec3(0.71,0.113,0.419)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i+vec3(0.,0.,0.)),hash(i+vec3(1.,0.,0.)),f.x),
                       mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                   mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),
                       mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 n = normalize(vWorld);
        vec3 p = n*2.3 + vec3(uSeed);
        float e = fbm(p);
        float sea = 0.5;
        vec3 col;
        if(e < sea){ col = mix(uOcean*0.5, uOcean, smoothstep(0.25, sea, e)); }
        else { float h=(e-sea)/(1.0-sea); col = mix(uLand, uLand*1.25+vec3(0.08), h);
               col = mix(col, vec3(0.92,0.9,0.86), smoothstep(0.72,1.0,h)); }
        float ice = smoothstep(0.74, 0.93, abs(n.y));
        col = mix(col, vec3(0.9,0.96,1.0), ice*0.92);
        float cl = smoothstep(0.56, 0.76, fbm(n*3.1 + vec3(uTime*0.02,0.0,0.0) + uSeed));
        col = mix(col, vec3(1.0), cl*0.32);
        float diff = max(dot(n, normalize(uLight)), 0.0);
        col *= 0.1 + diff;
        if(e >= sea){ float lights = step(0.86, fbm(p*4.3)); col += lights*(1.0-diff)*vec3(1.0,0.82,0.45)*0.6; }
        vec3 vd = normalize(uCam - vWorld);
        float rim = pow(1.0 - max(dot(n, vd), 0.0), 3.0);
        col += rim * vec3(0.30,0.55,1.0) * 1.3;
        gl_FragColor = vec4(col, 1.0);
      }`;
    const prog = this._program(vs, fs);
    if (!prog) { this.ok = false; return; }
    this.prog = prog;
    this.loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      uMVP: gl.getUniformLocation(prog, "uMVP"), uModel: gl.getUniformLocation(prog, "uModel"),
      uLand: gl.getUniformLocation(prog, "uLand"), uOcean: gl.getUniformLocation(prog, "uOcean"),
      uLight: gl.getUniformLocation(prog, "uLight"), uCam: gl.getUniformLocation(prog, "uCam"),
      uTime: gl.getUniformLocation(prog, "uTime"), uSeed: gl.getUniformLocation(prog, "uSeed"),
    };
    this._sphere(48, 72);
    gl.enable(gl.DEPTH_TEST);
    this.ok = true;
  },

  _shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      try { console.warn("Globe: shader compile failed —", gl.getShaderInfoLog(s)); } catch (e) {}
      gl.deleteShader(s); return null;
    }
    return s;
  },
  _program(vsrc, fsrc) {
    const gl = this.gl, v = this._shader(gl.VERTEX_SHADER, vsrc), f = this._shader(gl.FRAGMENT_SHADER, fsrc);
    if (!v || !f) return null;
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      try { console.warn("Globe: program link failed —", gl.getProgramInfoLog(p)); } catch (e) {}
      return null;
    }
    return p;
  },
  _sphere(rings, segs) {
    const gl = this.gl, pos = [], idx = [];
    for (let y = 0; y <= rings; y++) {
      const v = y / rings, theta = v * Math.PI;
      for (let x = 0; x <= segs; x++) {
        const u = x / segs, phi = u * TAU;
        pos.push(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
      }
    }
    for (let y = 0; y < rings; y++) for (let x = 0; x < segs; x++) {
      const a = y * (segs + 1) + x, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    this.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    this.count = idx.length;
  },

  resize() { if (!this.glcv) return; this.glcv.width = Math.floor(VIEW.w * VIEW.dpr); this.glcv.height = Math.floor(VIEW.h * VIEW.dpr); },
  show(on) { if (this.glcv) this.glcv.style.display = on ? "block" : "none"; },

  // matrices (column-major)
  _persp(out, fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); out.fill(0); out[0] = t / asp; out[5] = t; out[10] = (f + n) / (n - f); out[11] = -1; out[14] = 2 * f * n / (n - f); },
  _mul(o, a, b) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } },
  _model(out, rx, ry) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    // rotateX * rotateY
    const RX = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
    const RY = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
    this._mul(out, RX, RY);
  },

  // Camera distance chosen so the unit sphere fits BOTH axes (with margin),
  // regardless of aspect ratio — keeps the globe on-screen in portrait too.
  _camDist() {
    const t = 1 / Math.tan(Math.PI / 8);     // fov = 45°
    const asp = VIEW.w / VIEW.h, target = 0.82;
    return Math.max(2.7, t / target, t / (target * asp));
  },

  // project a unit-sphere direction to screen (CSS px). Returns {x,y,vis}
  project(dir, rx, ry) {
    this._model(this.model, rx, ry);
    const wx = this.model[0] * dir[0] + this.model[4] * dir[1] + this.model[8] * dir[2];
    const wy = this.model[1] * dir[0] + this.model[5] * dir[1] + this.model[9] * dir[2];
    const wz = this.model[2] * dir[0] + this.model[6] * dir[1] + this.model[10] * dir[2];
    const d = this._camDist(), ez = wz - d;
    const proj = new Float32Array(16); this._persp(proj, Math.PI / 4, VIEW.w / VIEW.h, 0.1, 20);
    const cx = proj[0] * wx, cy = proj[5] * wy, cw = proj[11] * ez;
    const ndcx = cx / cw, ndcy = cy / cw;
    return { x: (ndcx * 0.5 + 0.5) * VIEW.w, y: (1 - (ndcy * 0.5 + 0.5)) * VIEW.h, vis: wz > 0.04 };
  },

  render(rx, ry, land, ocean, time, seed) {
    if (!this.ok) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.glcv.width, this.glcv.height);
    gl.clearColor(0.02, 0.03, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    const d = this._camDist();
    const proj = new Float32Array(16); this._persp(proj, Math.PI / 4, VIEW.w / VIEW.h, 0.1, 20);
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -d, 1]);
    this._model(this.model, rx, ry);
    const pv = new Float32Array(16); this._mul(pv, proj, view); this._mul(this.mvp, pv, this.model);
    gl.uniformMatrix4fv(this.loc.uMVP, false, this.mvp);
    gl.uniformMatrix4fv(this.loc.uModel, false, this.model);
    gl.uniform3fv(this.loc.uLand, land); gl.uniform3fv(this.loc.uOcean, ocean);
    gl.uniform3fv(this.loc.uLight, [0.6, 0.45, 0.7]); gl.uniform3fv(this.loc.uCam, [0, 0, d]);
    gl.uniform1f(this.loc.uTime, time); gl.uniform1f(this.loc.uSeed, seed);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(this.loc.aPos);
    gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  },
};

// convert hex color -> [r,g,b] floats
function hexRGB(hex) {
  hex = hex.replace("#", ""); if (hex.length === 3) hex = hex.split("").map(x => x + x).join("");
  const n = parseInt(hex, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
// lat/lon (radians) -> unit sphere direction (lon 0 faces camera +Z)
function latLonDir(lat, lon) { return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }
