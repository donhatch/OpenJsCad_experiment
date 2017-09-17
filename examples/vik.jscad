// TODO: convex minkowski
// TODO: convex expand in terms of convex minkowski
// TODO: convex expand using a clever patch

function main() {


  try {

    let CHECK = function(cond) {
      if (cond !== true) {
        throw new Error("CHECK failed");
      }
    };

    // modelWidth=20, thickWallThickness=3, separation=1 or 3 or 10 -> $3.34 for one piece, $26.73 for 8 pieces, $15.04 if all fused together as 1 piece

    // Melinda's width is 17.52 mm (in some early model)
    let modelWidth = 20;

    let separation = 0.;
    //let separation = 3;
    //let separation = -.0001;
    //let separation = 1.5;
    //let separation = -3;

    let doPreRound = true;
    let preRoundRadius = .75;
    let preRoundRes = 20;
    //let preRoundRes = 40; // looks better but takes a while

    let thickWallThickness = 2;


    let dimpleRadius = .5;
    let dimpleDiskRadiusDegrees = 60.;
    let dimpleSphereRadius = dimpleRadius / Math.sin(dimpleDiskRadiusDegrees/180.*Math.PI);

    //let thinWallThickness = .7;  // .7 is minimum allowed
    let thinWallThickness = .675;  // .7 is minimum allowed

    let cylinderDiameter = 4;
    let cylinderResolution = 40;


    let showMagnetsOnly = false;
    let swissCheese = false;  // set to true to force thinWallThickness to 0


    // Note, scaleFudge other than 1 doesn't really work since the placements of dimples/pimples/cyls is still in the original space
    let scaleFudge = 1.;
    {
      modelWidth *= scaleFudge;
      separation *= scaleFudge;
      preRoundRadius *= scaleFudge;
      thickWallThickness *= scaleFudge;
      dimpleRadius *= scaleFudge;
      dimpleSphereRadius *= scaleFudge;
      thinWallThickness *= scaleFudge;
      cylinderDiameter *= scaleFudge;
    }

    //==================================================

    if (swissCheese) {
      thinWallThickness = 0.;
    }


    let vpv = (v0,v1) => {
      let answer = [];
      for (let i = 0; i < v0.length; ++i) {
        answer.push(v0[i] + v1[i]);
      }
      return answer;
    };
    let vmv = (v0,v1) => {
      let answer = [];
      for (let i = 0; i < v0.length; ++i) {
        answer.push(v0[i] - v1[i]);
      }
      return answer;
    };
    let sxv = (s,v) => {
      let answer = [];
      for (let x of v) { answer.push(s * x); }
      return answer;
    };
    let dot = (v0,v1) => {
      let answer = 0.;
      for (let i = 0; i < v0.length; ++i) {
        answer += v0[i] * v1[i];
      }
      return answer;
    };
    let len2 = v => dot(v,v);
    let len = v => Math.sqrt(len2(v));
    let normalized = v => sxv(len(v), v);

    //
    // Probably ill-advised geometry / vector math functions...
    //
    let rotateX = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[0], normal[1]*c - normal[2]*s, normal[1]*s + normal[2]*c], offset];
    };
    let rotateY = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[2]*s + normal[0]*c, normal[1], normal[2]*c - normal[0]*s], offset];
    };
    let rotateZ = function([normal,offset], degrees) {
      let s = Math.sin(degrees/180*Math.PI);
      let c = Math.cos(degrees/180*Math.PI);
      return [[normal[0]*c - normal[1]*s, normal[0]*s + normal[1]*c, normal[2]], offset];
    };
    let translatePlane = function([normal,offset], [dx,dy,dz]) {
      let len2 = normal[0]**2 + normal[1]**2 + normal[2]**2;

      let len = Math.sqrt(len2);
      let point = [offset*normal[0]/len, offset*normal[1]/len, offset*normal[2]/len];
      point[0] += dx;
      point[1] += dy;
      point[2] += dz;
      let answer = [normal, normal[0]*point[0] + normal[1]*point[1] + normal[2]*point[2]];
      return answer;
    };
    let scalePlane = function([normal,offset], s) {
      return [normal, offset*s];
    };
    let angleBetweenUnitVectors = (u,v) => {
      if (u.dot(v) < 0.) {
        return Math.PI - 2*Math.asin(u.plus(v).length()/2.);
      } else {
        return 2*Math.asin(u.minus(v).length()/2.);
      }
    };  // angleBetweenUnitVectors
    let sin_over_x = x => x==0. ? 1. : Math.sin(x)/x;
    // ang must be angleBetweenUnitVectors(u,v)
    let slerp = (u,v,ang,t) => {
      //CHECK(arguments.length == 4); // wait a minute, this doesn't hold for arrow functions??
      let denominator = sin_over_x(ang);
      let a = sin_over_x((1-t)*ang)/denominator * (1-t);
      let b = sin_over_x(t*ang)/denominator * t;
      if (false)
      {
      //for (let x in u) { console.log("          x = "+x); }
      console.log("t = "+t);
      console.log("denominator = "+denominator);
      console.log("a = "+a);
      console.log("b = "+b);
      }
      let answer = u.scale(a).plus(v.scale(b));
      return answer;
    };


    let rotateCSGtakingUnitVectorToUnitVector = (csg, from, to) => {
      // only works when from is z axis.
      CHECK(from[0] == 0);
      CHECK(from[1] == 0);
      CHECK(from[2] == 1);
      if (to[0] == 0 && to[1] == 0) {
        return to[2] >= 0 ? csg : csg.rotateX(180);
      }
      // XXX TODO: should use parallel transport math (2 householder reflections) instead of this
      let lat = Math.atan2(to[2], Math.hypot(to[0], to[1]));
      let lng = Math.atan2(to[1], to[0]);
      csg = csg.rotateY(90. - lat/Math.PI*180);  // Z axis towards X axis
      csg = csg.rotateZ(lng/Math.PI*180);  // X axis towards Y axis
      return csg;
    };

    let makeCylinderTheWayIThoughtItWasSupposedToWork = params => {
      if (false) {
        return CSG.cylinder(params);
      }
      // didn't have any luck with rotated start,end (produces weird shearing),
      // so start with axis aligned and...
      let start = params.start;
      let end = params.end;
      let cyl = CSG.cylinder({
        start: [0,0,0],
        end: [0,0,1],
        radius: cylinderDiameter/2.,
        resolution: cylinderResolution,
      });
      cyl = cyl.scale([1,1,len(vmv(end, start))]);
      let dir = normalized(vmv(end, start));
      cyl = rotateCSGtakingUnitVectorToUnitVector(cyl, [0,0,1], dir);
      cyl = cyl.translate(start);
      return cyl;
    };  // makeCylinderTheWayIThoughtItWasSupposedToWork

    // following logic of toPointCloud in OpenJsCad source
    let getVerts = A => {
      var answer = [];
      var seen = {};
      for (let polygon of A.polygons) {
        for (let vertex of polygon.vertices) {
          let vertexString = ""+vertex.pos.x+" "+vertex.pos.y+" "+vertex.pos.z;
          if (seen[vertexString] !== 1) {
            seen[vertexString] = 1;
            //answer.push(vertex);
            answer.push([vertex.pos.x, vertex.pos.y, vertex.pos.z]);
          }
        }
      }
      return answer;
    };  // getVerts

    let dumpCSG = (name,A) => {
      console.log("      "+name+":");
      if (false) {  // to see what methods are available
        for (let x in A) { console.log("          x = "+x); }
      }
      console.log("        verts = "+getVerts(A));
    };

    let convexMinkowski = (A,B) => {
      // CBB: this is O(|A|*|B|),
      // could make it faster by only scanning that part of the product
      // that might be on the exterior.
      // To be precise:
      //    -- take each vertex of A, translate it by only
      //       those vertices of B that could form exterior vertex of product
      //    -- take each face of A, translate it by only
      //       that vertex of B that's most extremal for it
      // Or, can we construct it easily by sweeping over the surface??
      // Anyway, here is the brain dead version.
      console.log("    in convexMinkowski");

      dumpCSG("A", A);
      dumpCSG("B", B);

      let Averts = getVerts(A);
      let Bverts = getVerts(B);
      let Cverts = [];
      for (let a of Averts) {
        for (let b of Bverts) {
          //Cverts.push(a.plus(b)); // use this if getVerts returns CSG points
          Cverts.push(vpv(a, b)); // use this if it returns tuples
        }
      }
      console.log("Cverts = "+Cverts);

      // ARGH! this doesn't exist, need to use convex hull function from elsewhere
      //let C = CSG.hull(Cverts);

      let C = A.subtract(B);

      console.log("    out convexMinkowski");
      return C;
    };  // convexMinkowski

    if (false)  // convexMinkowski is not panning out
    {
      let A = CSG.sphere({
        resolution:12,
      });
      let B = CSG.cube().scale(.75);
      let C = convexMinkowski(A, B);
      return C;
    }

    // Strange but simple semantics: resolution bevels are made, even if dihedral angles are wildly different.
    // And, resolution must be a power of 2.
    // That makes the spherical patches not too hard to grapple.
    // And, all vertices must have valence 3.
    let simpleConvexExpand = (A,radius,log2resolution) => {
      console.log("        in simpleConvexExpand");

      let verts = [];
      let f2v = [];  // face to vertex indices
      {
        let vertStringToVertIndex = {};
        for (let face of A.polygons) {
          f2v.push([]);
          for (let vertex of face.vertices) {
            let vertexString = ""+vertex.pos.x+" "+vertex.pos.y+" "+vertex.pos.z;
            let index = vertStringToVertIndex[vertexString];
            if (index === undefined) {
              index = verts.length;
              verts.push(vertex);
              vertStringToVertIndex[vertexString] = index;
            }
            f2v[f2v.length-1].push(index);
          }
        }
      }

      console.log("      verts = "+JSON.stringify(verts));
      console.log("      f2v = "+JSON.stringify(f2v));

      let e2v = [];  // list of ordered pairs of vertex indices. e2v[i^1] is the opposite of e2v[i].
      let f2e = [];  // face to edge indices, in order around p. f2e[p][i] is [f2v[p][i], f2v[p][(i+1)%f2v[p].length].
      let e2f = [];
      {
        let edgeKeyToEdgeIndex = {};
        for (let p = 0; p < f2v.length; ++p) {
          let poly = f2v[p];
          f2e.push([]);
          for (let i = 0; i < poly.length; ++i) {
            let v0 = poly[i];
            let v1 = poly[(i+1)%poly.length];
            let edgeKey = v0*verts.length+v1;
            let oppositeEdgeKey = v1*verts.length+v0;
            let edgeIndex = edgeKeyToEdgeIndex[edgeKey];
            if (edgeIndex === undefined) {
              edgeIndex = e2v.length;
              e2v.push([v0,v1]);
              e2v.push([v1,v0]);
              e2f.push(-1);
              e2f.push(-1);
              edgeKeyToEdgeIndex[edgeKey] = edgeIndex;
              edgeKeyToEdgeIndex[oppositeEdgeKey] = edgeIndex+1;
            }
            let oppositeEdgeIndex = edgeIndex^1;
            CHECK(edgeKeyToEdgeIndex[edgeKey] == edgeIndex);
            CHECK(edgeKeyToEdgeIndex[oppositeEdgeKey] == oppositeEdgeIndex);
            CHECK(e2v[edgeIndex][0] == v0);
            CHECK(e2v[edgeIndex][1] == v1);
            CHECK(e2v[oppositeEdgeIndex][0] == v1);
            CHECK(e2v[oppositeEdgeIndex][1] == v0);
            f2e[f2e.length-1].push(edgeIndex);
            e2f[edgeIndex] = p;
            // e2f[oppositeEdgeIndex] may not be set yet
          }
        }
      }
      for (let p of e2f) {
        CHECK(p >= 0);  // if this fails, non-manifold or something
      }

      console.log("      e2v = "+JSON.stringify(e2v));
      console.log("      f2e = "+JSON.stringify(f2e));

      let e2next = [];  // edge index to next edge index on same face
      let e2prev = [];  // edge index to next edge index on same face
      {
        for (let i = 0; i < e2v.length; ++i) {
          e2next.push(null);
          e2prev.push(null);
        }
        for (let f of f2e) {
          for (let i = 0; i < f.length; ++i) {
            e2next[f[i]] = f[(i+1)%f.length];
            e2prev[f[(i+1)%f.length]] = f[i];
          }
        }
      }
      console.log("      e2next = "+JSON.stringify(e2next));
      console.log("      e2prev = "+JSON.stringify(e2prev));

      // v2e[iVert] is the edges emanating from iVert,
      // in CW order (if faces are CCW).
      let v2e = [];
      {
        for (let iVert = 0; iVert < verts.length; ++iVert) {
          v2e.push([]);
        }
        for (let iEdge = 0; iEdge < e2v.length; ++iEdge) {
          let v0 = e2v[iEdge][0];
          if (v2e[v0].length == 0) {
            v2e[v0].push(iEdge);
            for (let jEdge = e2next[iEdge^1];
                 jEdge != iEdge;
                 jEdge = e2next[jEdge^1]) {
              v2e[v0].push(jEdge);
            }
          }
        }
      }
      console.log("      v2e = "+JSON.stringify(v2e));

      let answerPolygons = [];

      // Each face in A produces a face in answer.
      for (let polygon of A.polygons) {
        let offset = polygon.plane.normal.scale(radius);
        let answerPolygonVerts = [];
        for (let vertex of polygon.vertices) {
          answerPolygonVerts.push(vertex.translate(offset));
        }
        answerPolygons.push(new CSG.Polygon(answerPolygonVerts));
      }

      // Each edge in A produces a cylindrical patch in answer.
      for (let iWholeEdge = 0; 2*iWholeEdge < e2v.length; iWholeEdge++) {
        let iEdge = 2*iWholeEdge;
        let oEdge = iEdge+1;
        let f0 = e2f[iEdge];
        let f1 = e2f[oEdge];
        let v0 = e2v[iEdge][0];
        let v1 = e2v[iEdge][1];
        // The edge on f0 is [v0,v1].
        // The edge on f1 is [v1,v0].
        let f0normal = A.polygons[f0].plane.normal;
        let f1normal = A.polygons[f1].plane.normal;

        let angle = angleBetweenUnitVectors(f0normal, f1normal);

        let nSubdivsHere = 1<<log2resolution; // weird but tractable

        for (let i = 0; i < nSubdivsHere; ++i) {
          // calculate the two normals two different ways, to guarantee matching
          answerPolygons.push(new CSG.Polygon([
            verts[v0].translate(slerp(f0normal, f1normal, angle, i/nSubdivsHere).scale(radius)),
            verts[v0].translate(slerp(f0normal, f1normal, angle, (i+1)/nSubdivsHere).scale(radius)),
            verts[v1].translate(slerp(f1normal, f0normal, angle, (nSubdivsHere-1-i)/nSubdivsHere).scale(radius)),
            verts[v1].translate(slerp(f1normal, f0normal, angle, (nSubdivsHere-i)/nSubdivsHere).scale(radius)),
          ]));
        }
      }

      // Each vertex in A produces a spherical patch in answer.
      for (let iVert = 0; iVert < verts.length; ++iVert) {
        let theVertex = verts[iVert];
        //for (let x in theVertex) { console.log("          x = "+x); }
        let edgesThisVert = v2e[iVert];
        let answerPolygonVerts = [];
        for (let iEdgeThisVert = 0; iEdgeThisVert < edgesThisVert.length; ++iEdgeThisVert) {
          let e = edgesThisVert[iEdgeThisVert];
          answerPolygonVerts.push(theVertex.translate(A.polygons[e2f[e]].plane.normal.scale(radius)));
        }
        answerPolygonVerts.reverse();

        let patchPolygons = [new CSG.Polygon(answerPolygonVerts)];

        for (let iRes = 0; iRes < log2resolution; ++iRes) {
          let subdividedPatchPolygons = []
          for (let patchPolygon of patchPolygons) {
            let midpoints = [];
            for (let iEdgeThisPoly = 0; iEdgeThisPoly < patchPolygon.vertices.length; ++iEdgeThisPoly) {
              let v0 = patchPolygon.vertices[iEdgeThisPoly];
              let v1 = patchPolygon.vertices[(iEdgeThisPoly+1)%patchPolygon.vertices.length];
              let dir0 = v0.pos.minus(theVertex.pos);
              let dir1 = v1.pos.minus(theVertex.pos);
              // the lengths are equal to radius, but use length() instead, to avoid accumulating roundoff error.
              dir0 = dir0.scale(1./dir0.length());
              dir1 = dir1.scale(1./dir1.length());
              let offset = slerp(dir0, dir1, angleBetweenUnitVectors(dir0, dir1), .5).scale(radius);
              let midpoint = theVertex.translate(offset);
              midpoints.push(midpoint);

            }
            subdividedPatchPolygons.push(new CSG.Polygon(midpoints));

            for (let iVertThisPoly = 0; iVertThisPoly < patchPolygon.vertices.length; ++iVertThisPoly) {
              subdividedPatchPolygons.push(new CSG.Polygon([
                patchPolygon.vertices[iVertThisPoly],
                midpoints[iVertThisPoly],
                midpoints[(iVertThisPoly-1+midpoints.length)%midpoints.length],
              ]));
            }
          }

          patchPolygons = subdividedPatchPolygons;
        }

        for (let patchPolygon of patchPolygons) {
          answerPolygons.push(patchPolygon);
        }
      }

      let answer = CSG.fromPolygons(answerPolygons);

      console.log("        out simpleConvexExpand");
      return answer;
    };  // simpleConvexExpand

    if (false) {
      let A = CSG.cube({
        radius: 1./3,
      });
      let radius = .2;
      let log2resolution = 5;
      let B = simpleConvexExpand(A, radius, log2resolution);
      //B = simpleConvexExpand(B, radius, log2resolution);
      return B;
    }

    // End of utilities
    //=======================================================================


    // Start with 1/3 of the planes of the outer polyhedron...
    let planes = [
        [[0.3333333333333333,0.6666666666666667,0.6666666666666667],1.], // corner
        [[0.5773502691896258,0.5773502691896258,0.5773502691896258],0.8909765116357686], // face
        [[0.5,0.5,0.7071067811865475],0.9667811436055143], // frontishEdge
        [[0.5,0.7071067811865475,0.5],0.9667811436055143], // toppishEdge
        //[[-0.7071067811865475,0,-0.7071067811865475],0], // backLeftBounding
        //[[-0.7071067811865475,-0.7071067811865475,0],0], // downLeftBounding
        [[0.7071067811865475,0,-0.7071067811865475],0], // backRightBounding
        //[[0.7071067811865475,-0.7071067811865475,0],0], // downRightBounding
    ];

    // Rotate, to form all the planes of the outer polyhedron...
    if (true)
    {
      let n = planes.length;
      for (let i = 0; i < 2*n; ++i) {
        let plane = planes[i];
        let normal = plane[0];
        let offset = plane[1];
        // rotate z -> y -> -x
        //planes.push([[-normal[1],normal[2],normal[0]], offset]);
        // no, it's this instead.  I have no idea why.
        planes.push([[-normal[1],normal[2],-normal[0]], offset]);
      }
    }

    // its right corner is pointed at -1,1,1.  re-point it at 1,1,1.
    for (let plane of planes) {
      plane[0] = [plane[0][1], -plane[0][0], plane[0][2]];
    }
    console.log("planes.length = "+planes.length);
    //console.log("planes = "+planes);


    if (true) {
      // Try to get the three primary faces axis aligned at the origin
      for (let i = 0; i < planes.length; ++i) {
        let plane = planes[i];

        plane = rotateZ(plane, 45);
        plane = rotateX(plane, -Math.atan2(1,Math.sqrt(2))/Math.PI*180);
        plane = rotateY(plane, 60);
        plane = rotateX(plane, Math.atan2(1,Math.sqrt(2))/Math.PI*180);
        plane = rotateZ(plane, -45);
        plane = translatePlane(plane, [-1,-1,-1]);
        plane = rotateZ(plane, 180);
        plane = rotateX(plane, 90);

        // Fudge so first set of stuff is roughly on xy plane,
        // since that's what I assume when making cylinders
        plane = rotateY(plane, -90);
        plane = rotateZ(plane, -90);

        planes[i] = plane;
      }
    }

    let clay = CSG.cube({radius: 10});
    for (let planeSpec of planes) {
      let normal = planeSpec[0];
      let offset = planeSpec[1];
      //let plane = new CSG.Plane(normal, offset);
      var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
      clay = clay.cutByPlane(plane);
    }


    // Figure out bounding box
    if (false) {
      console.log("clay.getBounds() = "+clay.getBounds());
      console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
      console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
      console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
      console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
      console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
      console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
      console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
      console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
    }

    let scale = modelWidth/(clay.getBounds()[1].y - clay.getBounds()[0].y);  // arbitrary one of the three
    console.log("scaling by "+scale+" to get modelWidth="+modelWidth);

    clay = clay.scale(scale);
    if (false) {
      console.log("clay.getBounds() = "+clay.getBounds());
      console.log("clay.getBounds()[0] = "+clay.getBounds()[0]);
      console.log("clay.getBounds()[1] = "+clay.getBounds()[1]);
      console.log("clay.getBounds()[0].x = "+clay.getBounds()[0].x);
      console.log("clay.getBounds()[0].y = "+clay.getBounds()[0].y);
      console.log("clay.getBounds()[0].z = "+clay.getBounds()[0].z);
      console.log("clay.getBounds()[1].x = "+clay.getBounds()[1].x);
      console.log("clay.getBounds()[1].y = "+clay.getBounds()[1].y);
      console.log("clay.getBounds()[1].z = "+clay.getBounds()[1].z);
    }

    // and scale the planes too, to be used in subsequent operations
    for (let i = 0; i < planes.length; ++i) {
      planes[i] = scalePlane(planes[i], scale);
    }

    if (doPreRound && preRoundRadius > 0.) {
      console.log("    starting pre-round");
      clay = clay.contract(preRoundRadius, preRoundRes);
      console.log("    halfway done with pre-round");

      if (false) {
        //clay = clay.expand(preRoundRadius, preRoundRes);
      } else {
        //let log2resolution = 3;   // that's equivalent to 32 around a circle, for the right angles. (confusing)
        let log2resolution = 4;   // that's equivalent to 64 around a circle, for the right angles. (confusing)
        clay = simpleConvexExpand(clay, preRoundRadius, log2resolution);
      }

      console.log("    done with pre-round");
    }

    if (true) {
      // Try to place the dimples/pimples.
      let facePlane = planes[4];
      let [faceNormal,faceOffset] = facePlane;
      let elevationFudge = Math.cos(dimpleDiskRadiusDegrees/180.*Math.PI) * dimpleSphereRadius;
      console.log("elevationFudge = "+elevationFudge);
      let pimples = [];
      let dimples = [];
      {
        let center = [0,-2.25,3];
        // Adjust center so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
        center = vpv(center, delta);
        let sphere = CSG.sphere({
          radius: dimpleSphereRadius,
          center: center,
          resolution: 40,  // default is 12
        });
        pimples.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
        sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
        dimples.push(sphere.translate(sxv(elevationFudge, faceNormal)));
      }
      {
        let center = [0,-1.1,10];
        // Adjust center so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, center), faceNormal);
        center = vpv(center, delta);
        let sphere = CSG.sphere({
          radius: dimpleSphereRadius,
          center: center,
          resolution: 40,  // default is 12
        });
        pimples.push(sphere.translate(sxv(-elevationFudge, faceNormal)));
        sphere = sphere.mirrored(CSG.Plane.fromPoints([0,0,0],[1,0,0],[1,1,1]));
        dimples.push(sphere.translate(sxv(elevationFudge, faceNormal)));
      }
      // convert from array to single object
      pimples = pimples.reduce((a,b) => a.union(b));
      dimples = dimples.reduce((a,b) => a.union(b));

      if (true) {
        pimples = pimples.union(pimples.rotateZ(90).rotateY(90))
                         .union(pimples.rotateY(-90).rotateZ(-90));
        dimples = dimples.union(dimples.rotateZ(90).rotateY(90))
                         .union(dimples.rotateY(-90).rotateZ(-90));
      }

      clay = clay.union(pimples);
      clay = clay.subtract(dimples);
    }

    if (true) {
      let knife = CSG.cube({radius: 2*scale});
      for (let planeSpec of planes) {
        let normal = planeSpec[0];
        let offset = planeSpec[1];

        if (normal[0]>0 && normal[1]>0 && normal[2]>0) continue;

        offset -= thickWallThickness;
        var plane = CSG.Plane.fromNormalAndPoint(normal, [offset*normal[0], offset*normal[1], offset*normal[2]]);
        knife = knife.cutByPlane(plane);
      }
      clay = clay.subtract(knife);
    }


    if (true) {
      // Try to place cylindrical holes.
      let cyls = null;

      let cylHeight = thickWallThickness;

      {
        // one of the cylinders on corner face
        let x = 10.5;
        //let y = 4.5;
        let y = 5.5;
        let cyl = CSG.cylinder({
          start: [x,y,thinWallThickness],  // default start is [0,-1,0]
          end: [x,y,thinWallThickness+cylHeight], // default end is [0,1,0]
          radius: cylinderDiameter/2., // default radius is 1
          resolution: cylinderResolution, // default resolution is 32

          //center: true, // default: center:false   XXX doesn't seem to matter?
          center: [true,true,false], // default: center:false   XXX doesn't seem to matter-- always centers??
        });
        cyls = cyl;
      }

      {
        // 1 of the cylinders on "face" face
        let facePlane = planes[1];
        let [faceNormal,faceOffset] = facePlane;

        //let start = [14.75, 11, 0];

        // try closer together to make room for the clips
        // in one of the possible places
        //let start = [15, 11.75, 0];  // bad
        let start = [14.875, 11.625, 0];  // good

        // Adjust start so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
        start = vpv(start, delta);
        // Adjust start by thinWallThickness
        start = vpv(start, sxv(-thinWallThickness, faceNormal));
        let end = vpv(start, sxv(-thickWallThickness, faceNormal));

        let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
          start: start,
          end: end,
          radius: cylinderDiameter/2.,
          resolution: cylinderResolution,
        });

        cyls = cyls.union(cyl);
      }

      {
        // the cylinder on one of the "edge" faces
        let facePlane = planes[2];
        let [faceNormal,faceOffset] = facePlane;

        //let start = [5, 16.5, 0];
        //let start = [4.5, 16.675, 0];  // had this for a while, Melinda pointed out it won't have clearance
        //let start = [5.125, 16.675, 0];  // too close to edge! red
        //let start = [5.125, 16.5, 0];  // pretty good.  magnets might still be brushing though
        let start = [5.25, 16.5, 0];  // pretty good.  magnets might still be brushing though

        // Adjust start so it's on the plane
        let delta = sxv(faceOffset - dot(faceNormal, start), faceNormal);
        start = vpv(start, delta);
        // Adjust start by thinWallThickness
        start = vpv(start, sxv(-thinWallThickness, faceNormal));
        let end = vpv(start, sxv(-thickWallThickness, faceNormal));


        let cyl = makeCylinderTheWayIThoughtItWasSupposedToWork({
          start: start,
          end: end,
          radius: cylinderDiameter/2.,
          resolution: cylinderResolution,
        });

        cyls = cyls.union(cyl);
      }

      if (true) {
        cyls = cyls.union(cyls.mirrored(CSG.Plane.fromPoints([0,0,0],[1,1,0],[1,1,1])));
      }
      if (true) {
        cyls = cyls.union(cyls.rotateZ(90).rotateY(90))
                   .union(cyls.rotateY(-90).rotateZ(-90));
      }

      //clay = clay.union(cyls);
      clay = clay.subtract(cyls);
      //clay = cyls;

      if (showMagnetsOnly) {
        return cyls;
      }
    }

    clay = clay.translate([separation/2,separation/2,separation/2]);

    let answer = clay;
    if (false) {
      // Replicate 8 times
      answer = answer.union(answer.rotateZ(90));
      answer = answer.union(answer.rotateZ(180));
      answer = answer.union(answer.rotateX(180));
    }

    return answer;
  } catch (e) {
    console.error("HEY! caught: ",e);
    throw e;
  }
}
