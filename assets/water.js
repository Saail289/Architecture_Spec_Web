/* Shared WebGL water backdrop — used by the careers and application pages.
   Renders a fullscreen fragment shader: layered fbm swells, specular highlight,
   and a cursor-following ripple. Silently no-ops when WebGL is unavailable. */
window.initWater = function (canvas, opts) {
  opts = opts || {};
  if (!canvas) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  var MOODS = {
    Calm:  { amp: 0.7, speed: 0.6, ripple: 0.7 },
    Tidal: { amp: 1.0, speed: 1.0, ripple: 1.0 },
    Storm: { amp: 1.6, speed: 1.8, ripple: 1.6 }
  };
  var TINTS = {
    Violet:  { deep: [0.018, 0.019, 0.028], mid: [0.040, 0.030, 0.082], violet: [0.42, 0.17, 0.85], lilac: [0.62, 0.44, 1.0] },
    Abyss:   { deep: [0.010, 0.018, 0.026], mid: [0.018, 0.052, 0.075], violet: [0.10, 0.38, 0.70], lilac: [0.34, 0.74, 0.96] },
    Moonlit: { deep: [0.020, 0.020, 0.024], mid: [0.052, 0.050, 0.060], violet: [0.50, 0.50, 0.62], lilac: [0.86, 0.86, 0.94] }
  };
  var mood = MOODS[opts.mood] || MOODS.Tidal;
  var tint = TINTS[opts.tint] || TINTS.Violet;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision highp float;',
    'uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_infl;',
    'uniform float u_amp;uniform float u_speed;uniform float u_ripple;',
    'uniform vec3 u_deep;uniform vec3 u_mid;uniform vec3 u_violet;uniform vec3 u_lilac;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);',
    'float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
    'return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.0+vec2(1.7,9.2);a*=.5;}return v;}',
    // water height: layered swells (broad + medium + fine) + subtle cursor ripple
    'float height(vec2 p){',
    ' float t=u_time*u_speed;',
    ' vec2 w=p*0.9;',
    ' w+=0.14*vec2(fbm(w*0.7+t*0.02),fbm(w*0.7-t*0.02));',
    ' float h=fbm(w+vec2(t*0.03,t*0.017))*u_amp;',
    ' h+=0.34*u_amp*fbm(w*3.0+vec2(-t*0.05,t*0.04));',
    ' h+=0.14*u_amp*fbm(w*7.0+vec2(t*0.09,-t*0.07));',
    ' vec2 m=vec2(u_mouse.x*(u_res.x/u_res.y),u_mouse.y);',
    ' float dm=distance(p,m);',
    ' float ring=sin(dm*16.0-t*3.0)*exp(-dm*7.5);',
    ' h+=ring*u_ripple*u_infl;',
    ' return h;',
    '}',
    'void main(){',
    'vec2 uv=gl_FragCoord.xy/u_res.xy;',
    'float ar=u_res.x/u_res.y;',
    'vec2 p=vec2(uv.x*ar,uv.y);',
    'float e=0.004;',
    'float h=height(p);',
    'float hx=height(p+vec2(e,0.))-h;',
    'float hy=height(p+vec2(0.,e))-h;',
    'vec3 nor=normalize(vec3(-hx,-hy,e*2.0));',
    'vec3 ld=normalize(vec3(0.30,0.5,0.82));',
    'vec3 hlf=normalize(ld+vec3(0.,0.,1.));',
    'float spec=pow(max(dot(nor,hlf),0.),26.0);',
    'float fres=pow(1.0-max(nor.z,0.0),4.0);',
    'float band=smoothstep(0.25,0.95,h);',
    'vec3 col=mix(u_deep,u_mid,clamp(h*0.5+0.38,0.,1.));',
    'col+=u_mid*band*0.6;',
    'col+=u_lilac*spec*0.55;',
    'col+=u_violet*fres*0.14;',
    'float vig=smoothstep(1.3,0.30,length(uv-0.5));',
    'col*=0.76+0.24*vig;',
    'gl_FragColor=vec4(col,1.0);}'
  ].join('\n');

  var mk = function (type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  var prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var U = function (n) { return gl.getUniformLocation(prog, n); };
  var uRes = U('u_res'), uTime = U('u_time'), uMouse = U('u_mouse'), uInfl = U('u_infl');
  var uAmp = U('u_amp'), uSpeed = U('u_speed'), uRipple = U('u_ripple');
  var uDeep = U('u_deep'), uMid = U('u_mid'), uVio = U('u_violet'), uLit = U('u_lilac');

  var mouse = [0.5, 0.5], tmouse = [0.5, 0.5], infl = 0, tinfl = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  addEventListener('resize', resize);

  addEventListener('mousemove', function (e) {
    tmouse = [e.clientX / innerWidth, 1 - e.clientY / innerHeight];
    tinfl = 1;
  }, { passive: true });

  var t0 = performance.now();
  (function loop() {
    mouse[0] += (tmouse[0] - mouse[0]) * 0.08;
    mouse[1] += (tmouse[1] - mouse[1]) * 0.08;
    tinfl *= 0.96;
    infl += (tinfl - infl) * 0.1;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - t0) / 1000);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.uniform1f(uInfl, infl * mood.ripple);
    gl.uniform1f(uAmp, mood.amp);
    gl.uniform1f(uSpeed, mood.speed);
    gl.uniform1f(uRipple, 0.16);
    gl.uniform3fv(uDeep, tint.deep);
    gl.uniform3fv(uMid, tint.mid);
    gl.uniform3fv(uVio, tint.violet);
    gl.uniform3fv(uLit, tint.lilac);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(loop);
  })();
};
