/**
 * dk-qr - Professional QR Code Generator
 * A fully client-side QR code generator with customization options
 */

// ========================================
// QR Code Generator Library (Embedded)
// ========================================

const QRCode = (function() {
    // QR Code Generator Implementation
    const QRCodeModel = function(typeNumber, errorCorrectLevel) {
        this.typeNumber = typeNumber;
        this.errorCorrectLevel = errorCorrectLevel;
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    };

    QRCodeModel.prototype = {
        addData: function(data) {
            const newData = new QR8bitByte(data);
            this.dataList.push(newData);
            this.dataCache = null;
        },
        isDark: function(row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
                throw new Error(row + "," + col);
            }
            return this.modules[row][col];
        },
        getModuleCount: function() {
            return this.moduleCount;
        },
        make: function() {
            this.makeImpl(false, this.getBestMaskPattern());
        },
        makeImpl: function(test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (let row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (let col = 0; col < this.moduleCount; col++) {
                    this.modules[row][col] = null;
                }
            }
            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupPositionAdjustPattern();
            this.setupTimingPattern();
            this.setupTypeInfo(test, maskPattern);
            if (this.typeNumber >= 7) {
                this.setupTypeNumber(test);
            }
            if (this.dataCache == null) {
                this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
            }
            this.mapData(this.dataCache, maskPattern);
        },
        setupPositionProbePattern: function(row, col) {
            for (let r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (let c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
                        (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
                        (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        getBestMaskPattern: function() {
            let minLostPoint = 0;
            let pattern = 0;
            for (let i = 0; i < 8; i++) {
                this.makeImpl(true, i);
                const lostPoint = QRUtil.getLostPoint(this);
                if (i == 0 || minLostPoint > lostPoint) {
                    minLostPoint = lostPoint;
                    pattern = i;
                }
            }
            return pattern;
        },
        setupTimingPattern: function() {
            for (let r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] != null) continue;
                this.modules[r][6] = (r % 2 == 0);
            }
            for (let c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] != null) continue;
                this.modules[6][c] = (c % 2 == 0);
            }
        },
        setupPositionAdjustPattern: function() {
            const pos = QRUtil.getPatternPosition(this.typeNumber);
            for (let i = 0; i < pos.length; i++) {
                for (let j = 0; j < pos.length; j++) {
                    const row = pos[i];
                    const col = pos[j];
                    if (this.modules[row][col] != null) continue;
                    for (let r = -2; r <= 2; r++) {
                        for (let c = -2; c <= 2; c++) {
                            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                                this.modules[row + r][col + c] = true;
                            } else {
                                this.modules[row + r][col + c] = false;
                            }
                        }
                    }
                }
            }
        },
        setupTypeNumber: function(test) {
            const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
            for (let i = 0; i < 18; i++) {
                const mod = (!test && ((bits >> i) & 1) == 1);
                this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
            }
            for (let i = 0; i < 18; i++) {
                const mod = (!test && ((bits >> i) & 1) == 1);
                this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
            }
        },
        setupTypeInfo: function(test, maskPattern) {
            const data = (this.errorCorrectLevel << 3) | maskPattern;
            const bits = QRUtil.getBCHTypeInfo(data);
            for (let i = 0; i < 15; i++) {
                const mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) {
                    this.modules[i][8] = mod;
                } else if (i < 8) {
                    this.modules[i + 1][8] = mod;
                } else {
                    this.modules[this.moduleCount - 15 + i][8] = mod;
                }
            }
            for (let i = 0; i < 15; i++) {
                const mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 8) {
                    this.modules[8][this.moduleCount - i - 1] = mod;
                } else if (i < 9) {
                    this.modules[8][15 - i - 1 + 1] = mod;
                } else {
                    this.modules[8][15 - i - 1] = mod;
                }
            }
            this.modules[this.moduleCount - 8][8] = (!test);
        },
        mapData: function(data, maskPattern) {
            let inc = -1;
            let row = this.moduleCount - 1;
            let bitIndex = 7;
            let byteIndex = 0;
            for (let col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col--;
                while (true) {
                    for (let c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] == null) {
                            let dark = false;
                            if (byteIndex < data.length) {
                                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            }
                            const mask = QRUtil.getMask(maskPattern, row, col - c);
                            if (mask) {
                                dark = !dark;
                            }
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex == -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        }
    };

    QRCodeModel.createData = function(typeNumber, errorCorrectLevel, dataList) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
        const buffer = new QRBitBuffer();
        for (let i = 0; i < dataList.length; i++) {
            const data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
            data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
        }
        if (buffer.getLengthInBits() > totalDataCount * 8) {
            throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")");
        }
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
            buffer.put(0, 4);
        }
        while (buffer.getLengthInBits() % 8 != 0) {
            buffer.putBit(false);
        }
        while (true) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(0xEC, 8);
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(0x11, 8);
        }
        return QRCodeModel.createBytes(buffer, rsBlocks);
    };

    QRCodeModel.createBytes = function(buffer, rsBlocks) {
        let offset = 0;
        let maxDcCount = 0;
        let maxEcCount = 0;
        const dcdata = new Array(rsBlocks.length);
        const ecdata = new Array(rsBlocks.length);
        for (let r = 0; r < rsBlocks.length; r++) {
            const dcCount = rsBlocks[r].dataCount;
            const ecCount = rsBlocks[r].totalCount - dcCount;
            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);
            dcdata[r] = new Array(dcCount);
            for (let i = 0; i < dcdata[r].length; i++) {
                dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            }
            offset += dcCount;
            const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
            const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
            const modPoly = rawPoly.mod(rsPoly);
            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (let i = 0; i < ecdata[r].length; i++) {
                const modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
        }
        let totalCodeCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) {
            totalCodeCount += rsBlocks[i].totalCount;
        }
        const data = new Array(totalCodeCount);
        let index = 0;
        for (let i = 0; i < maxDcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) {
                    data[index++] = dcdata[r][i];
                }
            }
        }
        for (let i = 0; i < maxEcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) {
                    data[index++] = ecdata[r][i];
                }
            }
        }
        return data;
    };

    const QRMode = { MODE_8BIT_BYTE: 1 << 2 };
    const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

    const QR8bitByte = function(data) {
        this.mode = QRMode.MODE_8BIT_BYTE;
        this.data = data;
    };

    QR8bitByte.prototype = {
        getLength: function() {
            return this.data.length;
        },
        write: function(buffer) {
            for (let i = 0; i < this.data.length; i++) {
                buffer.put(this.data.charCodeAt(i), 8);
            }
        }
    };

    const QRUtil = {
        PATTERN_POSITION_TABLE: [
            [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
            [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
            [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
            [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
            [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
            [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
            [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
            [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
            [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
            [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
            [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
            [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
            [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
        ],
        G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
        G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
        G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
        getBCHTypeInfo: function(data) {
            let d = data << 10;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
                d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
            }
            return ((data << 10) | d) ^ QRUtil.G15_MASK;
        },
        getBCHTypeNumber: function(data) {
            let d = data << 12;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
                d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
            }
            return (data << 12) | d;
        },
        getBCHDigit: function(data) {
            let digit = 0;
            while (data != 0) {
                digit++;
                data >>>= 1;
            }
            return digit;
        },
        getPatternPosition: function(typeNumber) {
            return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
        },
        getMask: function(maskPattern, i, j) {
            switch (maskPattern) {
                case 0: return (i + j) % 2 == 0;
                case 1: return i % 2 == 0;
                case 2: return j % 3 == 0;
                case 3: return (i + j) % 3 == 0;
                case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
                case 5: return (i * j) % 2 + (i * j) % 3 == 0;
                case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
                case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
                default: throw new Error("bad maskPattern:" + maskPattern);
            }
        },
        getErrorCorrectPolynomial: function(errorCorrectLength) {
            let a = new QRPolynomial([1], 0);
            for (let i = 0; i < errorCorrectLength; i++) {
                a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
            }
            return a;
        },
        getLengthInBits: function(mode, type) {
            if (1 <= type && type < 10) return 8;
            else if (type < 27) return 16;
            else if (type < 41) return 16;
            else throw new Error("type:" + type);
        },
        getLostPoint: function(qrCode) {
            const moduleCount = qrCode.getModuleCount();
            let lostPoint = 0;
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    let sameCount = 0;
                    const dark = qrCode.isDark(row, col);
                    for (let r = -1; r <= 1; r++) {
                        if (row + r < 0 || moduleCount <= row + r) continue;
                        for (let c = -1; c <= 1; c++) {
                            if (col + c < 0 || moduleCount <= col + c) continue;
                            if (r == 0 && c == 0) continue;
                            if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
                        }
                    }
                    if (sameCount > 5) lostPoint += (3 + sameCount - 5);
                }
            }
            for (let row = 0; row < moduleCount - 1; row++) {
                for (let col = 0; col < moduleCount - 1; col++) {
                    let count = 0;
                    if (qrCode.isDark(row, col)) count++;
                    if (qrCode.isDark(row + 1, col)) count++;
                    if (qrCode.isDark(row, col + 1)) count++;
                    if (qrCode.isDark(row + 1, col + 1)) count++;
                    if (count == 0 || count == 4) lostPoint += 3;
                }
            }
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount - 6; col++) {
                    if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row, col + 1) &&
                        qrCode.isDark(row, col + 2) &&
                        qrCode.isDark(row, col + 3) &&
                        qrCode.isDark(row, col + 4) &&
                        !qrCode.isDark(row, col + 5) &&
                        qrCode.isDark(row, col + 6)) {
                        lostPoint += 40;
                    }
                }
            }
            for (let col = 0; col < moduleCount; col++) {
                for (let row = 0; row < moduleCount - 6; row++) {
                    if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                        qrCode.isDark(row + 2, col) &&
                        qrCode.isDark(row + 3, col) &&
                        qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                        qrCode.isDark(row + 6, col)) {
                        lostPoint += 40;
                    }
                }
            }
            let darkCount = 0;
            for (let col = 0; col < moduleCount; col++) {
                for (let row = 0; row < moduleCount; row++) {
                    if (qrCode.isDark(row, col)) darkCount++;
                }
            }
            const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
            lostPoint += ratio * 10;
            return lostPoint;
        }
    };

    const QRMath = {
        glog: function(n) {
            if (n < 1) throw new Error("glog(" + n + ")");
            return QRMath.LOG_TABLE[n];
        },
        gexp: function(n) {
            while (n < 0) n += 255;
            while (n >= 256) n -= 255;
            return QRMath.EXP_TABLE[n];
        },
        EXP_TABLE: new Array(256),
        LOG_TABLE: new Array(256)
    };

    for (let i = 0; i < 8; i++) {
        QRMath.EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i++) {
        QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^
            QRMath.EXP_TABLE[i - 5] ^
            QRMath.EXP_TABLE[i - 6] ^
            QRMath.EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) {
        QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
    }

    function QRPolynomial(num, shift) {
        if (num.length == undefined) throw new Error(num.length + "/" + shift);
        let offset = 0;
        while (offset < num.length && num[offset] == 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (let i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
    }

    QRPolynomial.prototype = {
        get: function(index) {
            return this.num[index];
        },
        getLength: function() {
            return this.num.length;
        },
        multiply: function(e) {
            const num = new Array(this.getLength() + e.getLength() - 1);
            for (let i = 0; i < this.getLength(); i++) {
                for (let j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
                }
            }
            return new QRPolynomial(num, 0);
        },
        mod: function(e) {
            if (this.getLength() - e.getLength() < 0) return this;
            const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
            const num = new Array(this.getLength());
            for (let i = 0; i < this.getLength(); i++) {
                num[i] = this.get(i);
            }
            for (let i = 0; i < e.getLength(); i++) {
                num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
            }
            return new QRPolynomial(num, 0).mod(e);
        }
    };

    const QRRSBlock = {
        RS_BLOCK_TABLE: [
            [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
            [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
            [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
            [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
            [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
            [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
            [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
            [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
            [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
            [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
            [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
            [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
            [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
            [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
            [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12],
            [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
            [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15],
            [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15],
            [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14],
            [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16],
            [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17],
            [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13],
            [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16],
            [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17],
            [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 24, 22, 55, 25], [22, 45, 15, 13, 46, 16],
            [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17],
            [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16],
            [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16],
            [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16],
            [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16],
            [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16],
            [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16],
            [17, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16],
            [13, 145, 115, 6, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17],
            [12, 151, 121, 7, 152, 122], [12, 75, 47, 26, 76, 48], [39, 54, 24, 14, 55, 25], [22, 45, 15, 41, 46, 16],
            [6, 151, 121, 14, 152, 122], [6, 75, 47, 34, 76, 48], [46, 54, 24, 10, 55, 25], [2, 45, 15, 64, 46, 16],
            [17, 152, 122, 4, 153, 123], [29, 74, 46, 14, 75, 47], [49, 54, 24, 10, 55, 25], [24, 45, 15, 46, 46, 16],
            [4, 152, 122, 18, 153, 123], [13, 74, 46, 32, 75, 47], [48, 54, 24, 14, 55, 25], [42, 45, 15, 32, 46, 16],
            [20, 147, 117, 4, 148, 118], [40, 75, 47, 7, 76, 48], [43, 54, 24, 22, 55, 25], [10, 45, 15, 67, 46, 16],
            [19, 148, 118, 6, 149, 119], [18, 75, 47, 31, 76, 48], [34, 54, 24, 34, 55, 25], [20, 45, 15, 61, 46, 16]
        ],
        getRSBlocks: function(typeNumber, errorCorrectLevel) {
            const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
            if (rsBlock == undefined) {
                throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
            }
            const length = rsBlock.length / 3;
            const list = [];
            for (let i = 0; i < length; i++) {
                const count = rsBlock[i * 3 + 0];
                const totalCount = rsBlock[i * 3 + 1];
                const dataCount = rsBlock[i * 3 + 2];
                for (let j = 0; j < count; j++) {
                    list.push({ totalCount: totalCount, dataCount: dataCount });
                }
            }
            return list;
        },
        getRsBlockTable: function(typeNumber, errorCorrectLevel) {
            switch (errorCorrectLevel) {
                case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
                case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
                case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
                case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
                default: return undefined;
            }
        }
    };

    function QRBitBuffer() {
        this.buffer = [];
        this.length = 0;
    }

    QRBitBuffer.prototype = {
        get: function(index) {
            const bufIndex = Math.floor(index / 8);
            return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
        },
        put: function(num, length) {
            for (let i = 0; i < length; i++) {
                this.putBit(((num >>> (length - i - 1)) & 1) == 1);
            }
        },
        getLengthInBits: function() {
            return this.length;
        },
        putBit: function(bit) {
            const bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) {
                this.buffer.push(0);
            }
            if (bit) {
                this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
            }
            this.length++;
        }
    };

    // Public API
    return {
        create: function(text, options = {}) {
            const errorCorrectLevel = QRErrorCorrectLevel[options.errorCorrectionLevel || 'M'];
            let typeNumber = options.typeNumber || 0;
            
            // Auto-detect type number if not specified
            if (typeNumber === 0) {
                for (let t = 1; t <= 40; t++) {
                    try {
                        const qr = new QRCodeModel(t, errorCorrectLevel);
                        qr.addData(text);
                        qr.make();
                        typeNumber = t;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            const qr = new QRCodeModel(typeNumber, errorCorrectLevel);
            qr.addData(text);
            qr.make();
            return qr;
        },
        
        toCanvas: function(qr, canvas, options = {}) {
            const size = options.size || 256;
            const margin = options.margin || 4;
            const fgColor = options.fgColor || '#000000';
            const bgColor = options.bgColor || '#ffffff';
            const transparent = options.transparent || false;
            const rounded = options.rounded || false;
            const logo = options.logo || null;
            
            const moduleCount = qr.getModuleCount();
            const cellSize = (size - margin * 2) / moduleCount;
            
            canvas.width = size;
            canvas.height = size;
            
            const ctx = canvas.getContext('2d');
            
            // Background
            if (!transparent) {
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, size, size);
            } else {
                ctx.clearRect(0, 0, size, size);
            }
            
            // QR modules
            ctx.fillStyle = fgColor;
            
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        const x = margin + col * cellSize;
                        const y = margin + row * cellSize;
                        
                        if (rounded) {
                            const radius = cellSize * 0.4;
                            ctx.beginPath();
                            ctx.roundRect(x, y, cellSize, cellSize, radius);
                            ctx.fill();
                        } else {
                            ctx.fillRect(x, y, cellSize, cellSize);
                        }
                    }
                }
            }
            
            // Center logo
            if (logo) {
                const logoSize = size * 0.2;
                const logoX = (size - logoSize) / 2;
                const logoY = (size - logoSize) / 2;
                
                // White background for logo
                ctx.fillStyle = bgColor;
                ctx.beginPath();
                ctx.roundRect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8, 8);
                ctx.fill();
                
                ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            }
            
            return canvas;
        }
    };
})();

// ========================================
// Application State
// ========================================

const state = {
    currentType: 'text',
    qrData: '',
    settings: {
        size: 256,
        fgColor: '#ffffff',
        bgColor: '#1a1a2e',
        transparent: false,
        errorCorrectionLevel: 'M',
        style: 'square',
        logo: null
    },
    history: [],
    debounceTimer: null
};

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Type buttons
    typeButtons: document.querySelectorAll('.type-btn'),
    
    // Forms
    forms: document.querySelectorAll('.qr-form'),
    
    // Inputs
    textContent: document.getElementById('text-content'),
    urlContent: document.getElementById('url-content'),
    phoneContent: document.getElementById('phone-content'),
    smsPhone: document.getElementById('sms-phone'),
    smsMessage: document.getElementById('sms-message'),
    emailTo: document.getElementById('email-to'),
    emailSubject: document.getElementById('email-subject'),
    emailBody: document.getElementById('email-body'),
    wifiSsid: document.getElementById('wifi-ssid'),
    wifiPassword: document.getElementById('wifi-password'),
    wifiSecurity: document.getElementById('wifi-security'),
    wifiHidden: document.getElementById('wifi-hidden'),
    socialPlatform: document.getElementById('social-platform'),
    socialUsername: document.getElementById('social-username'),
    vcardFirstname: document.getElementById('vcard-firstname'),
    vcardLastname: document.getElementById('vcard-lastname'),
    vcardPhone: document.getElementById('vcard-phone'),
    vcardEmail: document.getElementById('vcard-email'),
    vcardCompany: document.getElementById('vcard-company'),
    vcardTitle: document.getElementById('vcard-title'),
    vcardWebsite: document.getElementById('vcard-website'),
    vcardAddress: document.getElementById('vcard-address'),
    
    // Customization
    qrSize: document.getElementById('qr-size'),
    sizeValue: document.getElementById('size-value'),
    qrFgColor: document.getElementById('qr-fg-color'),
    qrBgColor: document.getElementById('qr-bg-color'),
    qrTransparent: document.getElementById('qr-transparent'),
    qrErrorCorrection: document.getElementById('qr-error-correction'),
    styleButtons: document.querySelectorAll('.style-btn'),
    qrLogo: document.getElementById('qr-logo'),
    logoFilename: document.getElementById('logo-filename'),
    removeLogo: document.getElementById('remove-logo'),
    
    // Preview
    qrPreview: document.getElementById('qr-preview'),
    
    // Actions
    btnDownload: document.getElementById('btn-download'),
    btnCopy: document.getElementById('btn-copy'),
    btnReset: document.getElementById('btn-reset'),
    
    // History
    historyList: document.getElementById('history-list'),
    btnClearHistory: document.getElementById('btn-clear-history'),
    
    // Theme
    themeToggle: document.getElementById('theme-toggle'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ========================================
// Utility Functions
// ========================================

/**
 * Debounce function to limit rapid calls
 */
function debounce(func, wait) {
    return function executedFunction(...args) {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    
    toast.innerHTML = `${icon}<span class="toast-message">${message}</span>`;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Generate data string based on QR type
 */
function generateQRData() {
    switch (state.currentType) {
        case 'text':
            return elements.textContent.value.trim();
            
        case 'url':
            let url = elements.urlContent.value.trim();
            if (url && !url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
            }
            return url;
            
        case 'phone':
            const phone = elements.phoneContent.value.trim();
            return phone ? `tel:${phone}` : '';
            
        case 'sms':
            const smsPhone = elements.smsPhone.value.trim();
            const smsMessage = elements.smsMessage.value.trim();
            if (!smsPhone) return '';
            return smsMessage 
                ? `sms:${smsPhone}?body=${encodeURIComponent(smsMessage)}`
                : `sms:${smsPhone}`;
                
        case 'email':
            const emailTo = elements.emailTo.value.trim();
            const emailSubject = elements.emailSubject.value.trim();
            const emailBody = elements.emailBody.value.trim();
            if (!emailTo) return '';
            let emailUrl = `mailto:${emailTo}`;
            const params = [];
            if (emailSubject) params.push(`subject=${encodeURIComponent(emailSubject)}`);
            if (emailBody) params.push(`body=${encodeURIComponent(emailBody)}`);
            if (params.length) emailUrl += '?' + params.join('&');
            return emailUrl;
            
        case 'wifi':
            const ssid = elements.wifiSsid.value.trim();
            const password = elements.wifiPassword.value;
            const security = elements.wifiSecurity.value;
            const hidden = elements.wifiHidden.checked;
            if (!ssid) return '';
            let wifiStr = `WIFI:T:${security};S:${ssid};`;
            if (security !== 'nopass' && password) {
                wifiStr += `P:${password};`;
            }
            if (hidden) wifiStr += 'H:true;';
            wifiStr += ';';
            return wifiStr;
            
        case 'social':
            const platform = elements.socialPlatform.value;
            let username = elements.socialUsername.value.trim();
            if (!username) return '';
            
            // If it's already a URL, use it directly
            if (username.match(/^https?:\/\//i)) {
                return username;
            }
            
            // Remove @ if present
            username = username.replace(/^@/, '');
            
            const socialUrls = {
                instagram: `https://instagram.com/${username}`,
                facebook: `https://facebook.com/${username}`,
                youtube: `https://youtube.com/@${username}`,
                whatsapp: `https://wa.me/${username.replace(/\D/g, '')}`,
                twitter: `https://x.com/${username}`,
                tiktok: `https://tiktok.com/@${username}`,
                linkedin: `https://linkedin.com/in/${username}`,
                snapchat: `https://snapchat.com/add/${username}`
            };
            
            return socialUrls[platform] || '';
            
        case 'vcard':
            const firstName = elements.vcardFirstname.value.trim();
            const lastName = elements.vcardLastname.value.trim();
            const vPhone = elements.vcardPhone.value.trim();
            const vEmail = elements.vcardEmail.value.trim();
            const company = elements.vcardCompany.value.trim();
            const title = elements.vcardTitle.value.trim();
            const website = elements.vcardWebsite.value.trim();
            const address = elements.vcardAddress.value.trim();
            
            if (!firstName && !lastName) return '';
            
            let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
            vcard += `N:${lastName};${firstName};;;\n`;
            vcard += `FN:${firstName} ${lastName}\n`;
            if (company) vcard += `ORG:${company}\n`;
            if (title) vcard += `TITLE:${title}\n`;
            if (vPhone) vcard += `TEL:${vPhone}\n`;
            if (vEmail) vcard += `EMAIL:${vEmail}\n`;
            if (website) vcard += `URL:${website}\n`;
            if (address) vcard += `ADR:;;${address};;;;\n`;
            vcard += 'END:VCARD';
            
            return vcard;
            
        default:
            return '';
    }
}

/**
 * Generate and display QR code
 */
function generateQR() {
    const data = generateQRData();
    state.qrData = data;
    
    if (!data) {
        // Show placeholder
        elements.qrPreview.innerHTML = `
            <div class="qr-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                    <rect x="14" y="14" width="3" height="3"/>
                    <rect x="18" y="14" width="3" height="3"/>
                    <rect x="14" y="18" width="3" height="3"/>
                    <rect x="18" y="18" width="3" height="3"/>
                </svg>
                <p>Enter content to generate QR code</p>
            </div>
        `;
        elements.qrPreview.classList.remove('has-qr');
        elements.btnDownload.disabled = true;
        elements.btnCopy.disabled = true;
        return;
    }
    
    try {
        const qr = QRCode.create(data, {
            errorCorrectionLevel: state.settings.errorCorrectionLevel
        });
        
        const canvas = document.createElement('canvas');
        QRCode.toCanvas(qr, canvas, {
            size: state.settings.size,
            margin: Math.floor(state.settings.size * 0.08),
            fgColor: state.settings.fgColor,
            bgColor: state.settings.bgColor,
            transparent: state.settings.transparent,
            rounded: state.settings.style === 'rounded',
            logo: state.settings.logo
        });
        
        elements.qrPreview.innerHTML = '';
        elements.qrPreview.appendChild(canvas);
        elements.qrPreview.classList.add('has-qr');
        elements.btnDownload.disabled = false;
        elements.btnCopy.disabled = false;
        
    } catch (error) {
        console.error('QR generation error:', error);
        showToast('Failed to generate QR code', 'error');
    }
}

// Debounced version
const debouncedGenerateQR = debounce(generateQR, 150);

/**
 * Download QR code as PNG
 */
function downloadQR() {
    const canvas = elements.qrPreview.querySelector('canvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `dk-qr-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Save to history
    saveToHistory();
    
    showToast('QR code downloaded successfully!');
}

/**
 * Copy QR code to clipboard
 */
async function copyQR() {
    const canvas = elements.qrPreview.querySelector('canvas');
    if (!canvas) return;
    
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        
        // Save to history
        saveToHistory();
        
        showToast('QR code copied to clipboard!');
    } catch (error) {
        // Fallback for browsers that don't support clipboard API
        showToast('Copy not supported in this browser', 'error');
    }
}

/**
 * Reset all inputs and settings
 */
function resetAll() {
    // Reset all form inputs
    document.querySelectorAll('input[type="text"], input[type="url"], input[type="email"], input[type="tel"], textarea').forEach(input => {
        input.value = '';
    });
    
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.querySelectorAll('select').forEach(select => {
        select.selectedIndex = 0;
    });
    
    // Reset settings
    state.settings = {
        size: 256,
        fgColor: '#ffffff',
        bgColor: '#1a1a2e',
        transparent: false,
        errorCorrectionLevel: 'M',
        style: 'square',
        logo: null
    };
    
    // Update UI
    elements.qrSize.value = 256;
    elements.sizeValue.textContent = '256';
    elements.qrFgColor.value = '#ffffff';
    elements.qrFgColor.nextElementSibling.textContent = '#ffffff';
    elements.qrBgColor.value = '#1a1a2e';
    elements.qrBgColor.nextElementSibling.textContent = '#1a1a2e';
    elements.qrTransparent.checked = false;
    elements.qrErrorCorrection.value = 'M';
    elements.logoFilename.textContent = 'Choose image...';
    elements.removeLogo.style.display = 'none';
    
    elements.styleButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === 'square');
    });
    
    generateQR();
    showToast('All settings reset');
}

/**
 * Save current QR to history
 */
function saveToHistory() {
    const canvas = elements.qrPreview.querySelector('canvas');
    if (!canvas || !state.qrData) return;
    
    const historyItem = {
        id: Date.now(),
        type: state.currentType,
        data: state.qrData,
        preview: canvas.toDataURL('image/png', 0.5),
        timestamp: new Date().toISOString()
    };
    
    // Add to beginning of history
    state.history.unshift(historyItem);
    
    // Keep only last 10 items
    if (state.history.length > 10) {
        state.history = state.history.slice(0, 10);
    }
    
    // Save to localStorage
    try {
        localStorage.setItem('dk-qr-history', JSON.stringify(state.history));
    } catch (e) {
        console.warn('Failed to save history to localStorage');
    }
    
    renderHistory();
}

/**
 * Load history from localStorage
 */
function loadHistory() {
    try {
        const saved = localStorage.getItem('dk-qr-history');
        if (saved) {
            state.history = JSON.parse(saved);
            renderHistory();
        }
    } catch (e) {
        console.warn('Failed to load history from localStorage');
    }
}

/**
 * Render history list
 */
function renderHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = `
            <div class="history-empty">
                <p>No recent QR codes</p>
            </div>
        `;
        return;
    }
    
    elements.historyList.innerHTML = state.history.map(item => `
        <div class="history-item" data-id="${item.id}">
            <div class="history-item-preview">
                <img src="${item.preview}" alt="QR preview">
            </div>
            <div class="history-item-info">
                <span class="history-item-type">${item.type}</span>
                <span class="history-item-content">${truncateText(item.data, 40)}</span>
            </div>
            <button class="history-item-delete" data-id="${item.id}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
    
    // Add click handlers
    elements.historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.history-item-delete')) {
                const id = parseInt(item.dataset.id);
                loadFromHistory(id);
            }
        });
    });
    
    elements.historyList.querySelectorAll('.history-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            deleteFromHistory(id);
        });
    });
}

/**
 * Load QR from history
 */
function loadFromHistory(id) {
    const item = state.history.find(h => h.id === id);
    if (!item) return;
    
    // Switch to the correct type
    switchType(item.type);
    
    // Set the data based on type
    setTimeout(() => {
        switch (item.type) {
            case 'text':
                elements.textContent.value = item.data;
                break;
            case 'url':
                elements.urlContent.value = item.data.replace(/^https?:\/\//, '');
                break;
            // Add more cases as needed
        }
        generateQR();
        showToast('Loaded from history');
    }, 100);
}

/**
 * Delete item from history
 */
function deleteFromHistory(id) {
    state.history = state.history.filter(h => h.id !== id);
    try {
        localStorage.setItem('dk-qr-history', JSON.stringify(state.history));
    } catch (e) {
        console.warn('Failed to save history');
    }
    renderHistory();
}

/**
 * Clear all history
 */
function clearHistory() {
    state.history = [];
    try {
        localStorage.removeItem('dk-qr-history');
    } catch (e) {
        console.warn('Failed to clear history');
    }
    renderHistory();
    showToast('History cleared');
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Switch QR type
 */
function switchType(type) {
    state.currentType = type;
    
    // Update type buttons
    elements.typeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    
    // Update forms
    elements.forms.forEach(form => {
        form.classList.toggle('active', form.id === `form-${type}`);
    });
    
    generateQR();
}

/**
 * Toggle theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    
    // Update default QR colors based on theme
    if (newTheme === 'light') {
        state.settings.fgColor = '#1a1a2e';
        state.settings.bgColor = '#ffffff';
        elements.qrFgColor.value = '#1a1a2e';
        elements.qrBgColor.value = '#ffffff';
    } else {
        state.settings.fgColor = '#ffffff';
        state.settings.bgColor = '#1a1a2e';
        elements.qrFgColor.value = '#ffffff';
        elements.qrBgColor.value = '#1a1a2e';
    }
    
    // Update color value displays
    elements.qrFgColor.nextElementSibling.textContent = state.settings.fgColor;
    elements.qrBgColor.nextElementSibling.textContent = state.settings.bgColor;
    
    try {
        localStorage.setItem('dk-qr-theme', newTheme);
    } catch (e) {
        console.warn('Failed to save theme preference');
    }
    
    generateQR();
}

/**
 * Load saved theme
 */
function loadTheme() {
    try {
        const savedTheme = localStorage.getItem('dk-qr-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            
            if (savedTheme === 'light') {
                state.settings.fgColor = '#1a1a2e';
                state.settings.bgColor = '#ffffff';
                elements.qrFgColor.value = '#1a1a2e';
                elements.qrBgColor.value = '#ffffff';
                elements.qrFgColor.nextElementSibling.textContent = '#1a1a2e';
                elements.qrBgColor.nextElementSibling.textContent = '#ffffff';
            }
        }
    } catch (e) {
        console.warn('Failed to load theme preference');
    }
}

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Type selection
    elements.typeButtons.forEach(btn => {
        btn.addEventListener('click', () => switchType(btn.dataset.type));
    });
    
    // Form inputs - live QR generation
    const allInputs = document.querySelectorAll('input[type="text"], input[type="url"], input[type="email"], input[type="tel"], input[type="password"], textarea, select, input[type="checkbox"]');
    allInputs.forEach(input => {
        input.addEventListener('input', debouncedGenerateQR);
        input.addEventListener('change', debouncedGenerateQR);
    });
    
    // Size slider
    elements.qrSize.addEventListener('input', () => {
        state.settings.size = parseInt(elements.qrSize.value);
        elements.sizeValue.textContent = state.settings.size;
        debouncedGenerateQR();
    });
    
    // Color pickers
    elements.qrFgColor.addEventListener('input', () => {
        state.settings.fgColor = elements.qrFgColor.value;
        elements.qrFgColor.nextElementSibling.textContent = elements.qrFgColor.value;
        debouncedGenerateQR();
    });
    
    elements.qrBgColor.addEventListener('input', () => {
        state.settings.bgColor = elements.qrBgColor.value;
        elements.qrBgColor.nextElementSibling.textContent = elements.qrBgColor.value;
        debouncedGenerateQR();
    });
    
    // Transparent background
    elements.qrTransparent.addEventListener('change', () => {
        state.settings.transparent = elements.qrTransparent.checked;
        generateQR();
    });
    
    // Error correction
    elements.qrErrorCorrection.addEventListener('change', () => {
        state.settings.errorCorrectionLevel = elements.qrErrorCorrection.value;
        generateQR();
    });
    
    // Style buttons
    elements.styleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.styleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.settings.style = btn.dataset.style;
            generateQR();
        });
    });
    
    // Logo upload
    elements.qrLogo.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    state.settings.logo = img;
                    elements.logoFilename.textContent = file.name;
                    elements.removeLogo.style.display = 'block';
                    generateQR();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Remove logo
    elements.removeLogo.addEventListener('click', () => {
        state.settings.logo = null;
        elements.qrLogo.value = '';
        elements.logoFilename.textContent = 'Choose image...';
        elements.removeLogo.style.display = 'none';
        generateQR();
    });
    
    // Password visibility toggle
    document.querySelectorAll('.toggle-visibility').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                btn.classList.add('active');
            } else {
                input.type = 'password';
                btn.classList.remove('active');
            }
        });
    });
    
    // Action buttons
    elements.btnDownload.addEventListener('click', downloadQR);
    elements.btnCopy.addEventListener('click', copyQR);
    elements.btnReset.addEventListener('click', resetAll);
    
    // History
    elements.btnClearHistory.addEventListener('click', clearHistory);
    
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
}

// ========================================
// Initialize Application
// ========================================

function init() {
    loadTheme();
    loadHistory();
    initEventListeners();
    generateQR();
    
    console.log('dk-qr initialized successfully');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
