/**
 * DOMMatrix polyfill for pdfjs-dist 5.x in Node.js serverless environments.
 * pdfjs-dist uses DOMMatrix at module-level initialization; this must be called
 * before importing pdfjs-dist.
 */
export function setupDOMPolyfills() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return

  class DOMMatrixPolyfill {
    m11: number; m12: number; m13: number; m14: number
    m21: number; m22: number; m23: number; m24: number
    m31: number; m32: number; m33: number; m34: number
    m41: number; m42: number; m43: number; m44: number
    is2D: boolean
    isIdentity: boolean

    get a() { return this.m11 }
    get b() { return this.m12 }
    get c() { return this.m21 }
    get d() { return this.m22 }
    get e() { return this.m41 }
    get f() { return this.m42 }
    set a(v: number) { this.m11 = v }
    set b(v: number) { this.m12 = v }
    set c(v: number) { this.m21 = v }
    set d(v: number) { this.m22 = v }
    set e(v: number) { this.m41 = v }
    set f(v: number) { this.m42 = v }

    constructor(init?: number[] | string) {
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1
      this.is2D = true
      this.isIdentity = true

      if (Array.isArray(init)) {
        if (init.length === 6) {
          this.m11 = init[0]; this.m12 = init[1]
          this.m21 = init[2]; this.m22 = init[3]
          this.m41 = init[4]; this.m42 = init[5]
        } else if (init.length === 16) {
          [this.m11, this.m12, this.m13, this.m14,
            this.m21, this.m22, this.m23, this.m24,
            this.m31, this.m32, this.m33, this.m34,
            this.m41, this.m42, this.m43, this.m44] = init
          this.is2D = false
        }
        this.isIdentity =
          this.m11 === 1 && this.m12 === 0 && this.m21 === 0 && this.m22 === 1 &&
          this.m41 === 0 && this.m42 === 0
      }
    }

    static fromMatrix(m: Partial<DOMMatrixPolyfill>) {
      const vals = [
        m.m11 ?? 1, m.m12 ?? 0, m.m13 ?? 0, m.m14 ?? 0,
        m.m21 ?? 0, m.m22 ?? 1, m.m23 ?? 0, m.m24 ?? 0,
        m.m31 ?? 0, m.m32 ?? 0, m.m33 ?? 1, m.m34 ?? 0,
        m.m41 ?? 0, m.m42 ?? 0, m.m43 ?? 0, m.m44 ?? 1,
      ]
      return new DOMMatrixPolyfill(vals)
    }

    static fromFloat32Array(arr: Float32Array) { return new DOMMatrixPolyfill(Array.from(arr)) }
    static fromFloat64Array(arr: Float64Array) { return new DOMMatrixPolyfill(Array.from(arr)) }

    multiply(m: DOMMatrixPolyfill) {
      return new DOMMatrixPolyfill([
        this.m11 * m.m11 + this.m12 * m.m21 + this.m13 * m.m31 + this.m14 * m.m41,
        this.m11 * m.m12 + this.m12 * m.m22 + this.m13 * m.m32 + this.m14 * m.m42,
        this.m11 * m.m13 + this.m12 * m.m23 + this.m13 * m.m33 + this.m14 * m.m43,
        this.m11 * m.m14 + this.m12 * m.m24 + this.m13 * m.m34 + this.m14 * m.m44,
        this.m21 * m.m11 + this.m22 * m.m21 + this.m23 * m.m31 + this.m24 * m.m41,
        this.m21 * m.m12 + this.m22 * m.m22 + this.m23 * m.m32 + this.m24 * m.m42,
        this.m21 * m.m13 + this.m22 * m.m23 + this.m23 * m.m33 + this.m24 * m.m43,
        this.m21 * m.m14 + this.m22 * m.m24 + this.m23 * m.m34 + this.m24 * m.m44,
        this.m31 * m.m11 + this.m32 * m.m21 + this.m33 * m.m31 + this.m34 * m.m41,
        this.m31 * m.m12 + this.m32 * m.m22 + this.m33 * m.m32 + this.m34 * m.m42,
        this.m31 * m.m13 + this.m32 * m.m23 + this.m33 * m.m33 + this.m34 * m.m43,
        this.m31 * m.m14 + this.m32 * m.m24 + this.m33 * m.m34 + this.m34 * m.m44,
        this.m41 * m.m11 + this.m42 * m.m21 + this.m43 * m.m31 + this.m44 * m.m41,
        this.m41 * m.m12 + this.m42 * m.m22 + this.m43 * m.m32 + this.m44 * m.m42,
        this.m41 * m.m13 + this.m42 * m.m23 + this.m43 * m.m33 + this.m44 * m.m43,
        this.m41 * m.m14 + this.m42 * m.m24 + this.m43 * m.m34 + this.m44 * m.m44,
      ])
    }

    translate(tx = 0, ty = 0, tz = 0) {
      const m = new DOMMatrixPolyfill([this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41 + tx, this.m42 + ty, this.m43 + tz, this.m44])
      return m
    }

    scale(sx = 1, sy = sx, sz = 1) {
      return new DOMMatrixPolyfill([
        this.m11 * sx, this.m12 * sx, this.m13 * sx, this.m14,
        this.m21 * sy, this.m22 * sy, this.m23 * sy, this.m24,
        this.m31 * sz, this.m32 * sz, this.m33 * sz, this.m34,
        this.m41, this.m42, this.m43, this.m44,
      ])
    }

    rotate(degX = 0, degY = 0, degZ = 0) {
      const rad = degZ * Math.PI / 180
      const cos = Math.cos(rad); const sin = Math.sin(rad)
      return new DOMMatrixPolyfill([cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    }

    skewX(deg = 0) {
      const t = Math.tan(deg * Math.PI / 180)
      return new DOMMatrixPolyfill([1, 0, 0, 0, t, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    }

    skewY(deg = 0) {
      const t = Math.tan(deg * Math.PI / 180)
      return new DOMMatrixPolyfill([1, t, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    }

    inverse() {
      // Simple 2D inverse
      const det = this.m11 * this.m22 - this.m12 * this.m21
      if (Math.abs(det) < 1e-10) return new DOMMatrixPolyfill()
      const invDet = 1 / det
      return new DOMMatrixPolyfill([
        this.m22 * invDet, -this.m12 * invDet, 0, 0,
        -this.m21 * invDet, this.m11 * invDet, 0, 0,
        0, 0, 1, 0,
        (this.m21 * this.m42 - this.m22 * this.m41) * invDet,
        (this.m12 * this.m41 - this.m11 * this.m42) * invDet,
        0, 1,
      ])
    }

    flipX() { return this.scale(-1, 1) }
    flipY() { return this.scale(1, -1) }

    transformPoint(p: { x?: number; y?: number; z?: number; w?: number } = {}) {
      const x = p.x ?? 0; const y = p.y ?? 0; const z = p.z ?? 0; const w = p.w ?? 1
      return {
        x: x * this.m11 + y * this.m21 + z * this.m31 + w * this.m41,
        y: x * this.m12 + y * this.m22 + z * this.m32 + w * this.m42,
        z: x * this.m13 + y * this.m23 + z * this.m33 + w * this.m43,
        w: x * this.m14 + y * this.m24 + z * this.m34 + w * this.m44,
      }
    }

    toFloat32Array() {
      return new Float32Array([this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44])
    }

    toFloat64Array() {
      return new Float64Array([this.m11, this.m12, this.m13, this.m14,
        this.m21, this.m22, this.m23, this.m24,
        this.m31, this.m32, this.m33, this.m34,
        this.m41, this.m42, this.m43, this.m44])
    }

    toString() {
      return `matrix(${this.m11},${this.m12},${this.m21},${this.m22},${this.m41},${this.m42})`
    }

    toJSON() {
      return {
        a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f,
        m11: this.m11, m12: this.m12, m13: this.m13, m14: this.m14,
        m21: this.m21, m22: this.m22, m23: this.m23, m24: this.m24,
        m31: this.m31, m32: this.m32, m33: this.m33, m34: this.m34,
        m41: this.m41, m42: this.m42, m43: this.m43, m44: this.m44,
        is2D: this.is2D, isIdentity: this.isIdentity,
      }
    }
  }

  ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
  ;(globalThis as any).DOMMatrixReadOnly = DOMMatrixPolyfill
}
