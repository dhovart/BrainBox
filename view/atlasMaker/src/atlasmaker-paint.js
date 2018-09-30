/* global AtlasMakerWidget */
/*! AtlasMaker: Painting commands */
import $ from 'jquery';

/**
 * @page AtlasMaker: Painting commands
 */
export var AtlasMakerPaint = {
    //====================================================================================
    // Paint functions
    //====================================================================================
    showxy: function showxy(u, c, x, y, usr) {
        const me=AtlasMakerWidget;
        // u: user number
        // c: command
        // x, y: coordinates
        const msg={c: c, x: x, y: y};
        if(u === -1 && JSON.stringify(msg)!==JSON.stringify(me.msg0)) {
            me.sendShowMessage(msg);
            me.msg0=msg;
        }
        if(u !== -1) {
            switch(c) {
                case 'u':
                    if(usr.pointer) {
                        usr.pointer.remove();
                        delete usr.pointer;
                    }
                    break;
                case 'm':
                    if(!usr.pointer) {
                        usr.pointer = $([
                            '<div style="display:inline-block;height:20px;margin-left:-10px;margin-top:-10px;position:absolute;color:white">',
                            '<img src="' + me.hostname + '/img/show.svg" height="100%"/>',
                            ((usr.username === 'Anonymous')?u:usr.username),
                            '</div>'
                            ].join(''));
                        $("#resizable").append(usr.pointer);
                    }
                    usr.pointer.css({left:x*$("#resizable").width()/me.brain_W, top:y*$("#resizable").height()/me.brain_H});
                    break;
            }
        }
        usr.x0=x;
        usr.y0=y;
    },

    /**
     * @function paintxy
     * @desc Dispatches paint/erase commands to the annotation volume and to the server for broadcast
     * @param {integer} u The number of the user producing the paint event. u === -1 means that the paint event was produced by a different user, and it is not broadcasted (to prevent loops)
     * @param {character} c The paint command: le, lf, e, f.
     * @param {integer} x X coordinate in slice space
     * @param {integer} y Y coordinate in slice space
     * @param {Object} usr User object for the current user. Contains the painting value, view and slice
     * @returns {void}
     */
    paintxy: function paintxy(u, c, x, y, usr) {
        const me=AtlasMakerWidget;
        // u: user number
        // c: command
        // x, y: coordinates
        const msg={c:c, x:x, y:y};

        if(u === -1 && JSON.stringify(msg) !== JSON.stringify(me.msg0)) {
            me.sendPaintMessage(msg);
            me.msg0 = msg;
        }

        var coord={x:x, y:y, z:usr.slice};
        if(usr.x0<0) {
            usr.x0=coord.x;
            usr.y0=coord.y;
        }

        if(u !== -1) {
            if(c === 'mu') {
                if(usr.pointer) {
                    usr.pointer.remove();
                    delete usr.pointer;
                }
            } else {
                if(!usr.pointer) {
                    usr.pointer = $([
                        '<div style="display:inline-block;height:20px;margin-left:-10px;margin-top:-10px;position:absolute;color:white">',
                        '<img src="' + me.hostname + '/img/show.svg" height="100%"/>',
                        ((usr.username === 'Anonymous')?u:usr.username),
                        '</div>'
                        ].join(''));
                    $("#resizable").append(usr.pointer);
                }
                usr.pointer.css({left:x*$("#resizable").width()/me.brain_W, top:y*$("#resizable").height()/me.brain_H});
            }
        }
        var val = usr.penValue;
        switch(c) {
            case 'le':
                me.line(coord.x, coord.y, 0, usr);
                break;
            case 'lf':
                me.line(coord.x, coord.y, val, usr);
                break;
            case 'e':
                me.fill(coord.x, coord.y, coord.z, 0, usr.view);
                break;
            case 'f':
                me.fill(coord.x, coord.y, coord.z, val, usr.view);
                break;
        }

        usr.x0=coord.x;
        usr.y0=coord.y;
    },

    /**
     * @function paintvol
     * @desc Paints a series of voxels as indicated in an array. This function is exclusively used for undoing
     * @param {Array} voxels Array where each object contains a voxel index and a voxel value. The voxel index goes from 0 to dim[0]*dim[1]*dim[2]-1
     * @returns {void}
     */
    paintvol: function paintvol(voxels) {
        const me=AtlasMakerWidget;
        let i;
        for(i=0; i<voxels.length; i++) {
            // ind: voxel index
            // val: voxel delta-value, such that -=val undoes
            const [ind, val] = voxels[i];
            me.atlas.data[ind]=val;
        }
        me.drawImages();
    },

    /**
     * @function fill
     * @desc Fills a 2D slice in an annotation volume starting at coordinates x, y, z replacing all the connected pixels of same value as the original value at x, y, z
     * @param {number} x X coordinate in voxel space
     * @param {number} y Y coordinate in voxel space
     * @param {number} z Z coordinate in voxel space
     * @param {number} val Value to fill with
     * @param {string} myView The stereotaxic plane along which to fill: either 'cor', 'axi' or 'sag'
     * @returns {void}
     */
    fill: function fill(x, y, z, val, myView) {
        const me = AtlasMakerWidget;
        const {atlas} = me;

        const Q=[];
        let left, n, right;
        let max = 0;
        const bval = atlas.data[me.slice2index(x, y, z, myView)]; // background-value: value of the voxel where the click occurred

        if(bval === val) { return; }

        Q.push({x:x, y:y});
        while(Q.length>0) {
            if(Q.length>max) { max=Q.length; }
            n=Q.shift();
            if(atlas.data[me.slice2index(n.x, n.y, z, myView)] !== bval) { continue; }
            left=n.x;
            right=n.x;
            y=n.y;
            while (left-1>=0 && atlas.data[me.slice2index(left-1, y, z, myView)] === bval) {
                left--;
            }
            while (right + 1<me.brain_W && atlas.data[me.slice2index(right + 1, y, z, myView)] === bval) {
                right++;
            }
            for(x=left; x<=right; x++) {
                atlas.data[me.slice2index(x, y, z, myView)]=val;
                if(y-1>=0 && atlas.data[me.slice2index(x, y-1, z, myView)] === bval) { Q.push({x:x, y:y-1}); }
                if(y + 1<me.brain_H && atlas.data[me.slice2index(x, y + 1, z, myView)] === bval) { Q.push({x:x, y:y + 1}); }
            }
        }
        me.drawImages();
        console.log("max array size for fill:", max);
    },

    /**
     * @function line
     * @param {number} x X coordinate
     * @param {number} y Y coordinate
     * @param {number} val Value to use when painting
     * @param {object} usr User object
     * @returns {void}
     */
    line: function line(x, y, val, usr) {
        const me=AtlasMakerWidget;
        // Bresenham's line algorithm adapted from
        // http://stackoverflow.com/questions/4672279/bresenham-algorithm-in-javascript

        const {atlas} = me;
        var xyzi1=new Array(4);
        var xyzi2=new Array(4);
        var i, j, k;
        var x1=usr.x0;
        var y1=usr.y0;
        var x2=x;
        var y2=y;
        var z=usr.slice;

        // Define differences and error check
        var dx = Math.abs(x2 - x1);
        var dy = Math.abs(y2 - y1);
        var sx = (x1 < x2) ? 1 : -1;
        var sy = (y1 < y2) ? 1 : -1;
        var err = dx - dy;

        xyzi1=me.slice2xyzi(x1, y1, z, usr.view);
        xyzi2=me.slice2xyzi(x2, y2, z, usr.view);
        me.annotationLength+=Math.sqrt( Math.pow(me.brain_pixdim[0]*(xyzi1[0]-xyzi2[0]), 2)+
                                        Math.pow(me.brain_pixdim[1]*(xyzi1[1]-xyzi2[1]), 2)+
                                        Math.pow(me.brain_pixdim[2]*(xyzi1[2]-xyzi2[2]), 2));

        for(j=0; j<Math.min(usr.penSize, me.brain_W-x1); j++) {
            for(k=0; k<Math.min(usr.penSize, me.brain_H-y1); k++) {
                i=me.slice2index(x1+j, y1+k, z, usr.view);
                atlas.data[i]=val;
            }
        }

        while (!((x1 === x2) && (y1 === y2))) {
            var e2 = err << 1;
            if (e2 > -dy) {
                err -= dy;
                x1 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y1 += sy;
            }
            for(j=0; j<Math.min(usr.penSize, me.brain_W-x1); j++) {
                for(k=0; k<Math.min(usr.penSize, me.brain_H-y1); k++) {
                    i=me.slice2index(x1+j, y1+k, z, usr.view);
                    atlas.data[i]=val;
                }
            }
        }
        me.drawImages();
    },

    /**
     * @function slice2index
     * @desc Convert slice coordinates into voxel index
     * @param {number} mx X coordinate
     * @param {number} my Y coordinate
     * @param {number} mz Z coordinate
     * @param {string} myView String representing the view: 'sag', 'cor' or 'axi'
     * @returns {number} MRI volume voxel index
     */
    slice2index: function slice2index(mx, my, mz, myView) {
        const me=AtlasMakerWidget;
        let x, y, z;
        switch(myView) {
            case 'sag': x=mz; y=mx; z=me.brain_H-1-my; break; // sagital
            case 'cor': x=mx; y=mz; z=me.brain_H-1-my; break; // coronal
            case 'axi': x=mx; y=me.brain_H-1-my; z=mz; break; // axial
        }
        const s=[x, y, z];
        const i=me.S2I(s, me.User);

        return i;
    },

    /**
     * @function slice2xyzi
     * @desc Convert slice coordinates into voxel coordinates
     * @param {number} mx X coordinate
     * @param {number} my Y coordinate
     * @param {number} mz Z coordinate
     * @param {string} myView String representing the view: 'sag', 'cor' or 'axi'
     * @returns {array} An array [x,y,z,i] where the first 3 values are the voxel coordinates and the 4th value is the voxel index (value from 0 to dim[0]*dim[1]*dim[2]-1)
     */
    slice2xyzi: function slice2xyzi(mx, my, mz, myView) {
        const me=AtlasMakerWidget;
        let x, y, z;
        switch(myView) {
            case 'sag': x=mz; y=mx; z=me.brain_H-1-my; break; // sagital
            case 'cor': x=mx; y=mz; z=me.brain_H-1-my; break; // coronal
            case 'axi': x=mx; y=me.brain_H-1-my; z=mz; break; // axial
        }
        const s=[x, y, z];
        const i=me.S2I(s, me.User);

        return [x, y, z, i];
    }
};
