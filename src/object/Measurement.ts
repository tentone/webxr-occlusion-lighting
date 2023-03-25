import {BufferGeometry, Line, Line3, LineBasicMaterial, Vector3} from "three";
import {Text} from "troika-three-text";

/**
 * Represents a measurement from a point to another.
 */
export class Measurement extends Line
{
	/**
	 * List of points that compose the measurement.
	 */
	public points: any[] ;

	/**
	 * Text used to display the measurement value.
	 */
	public text: Text = new Text();

	/**
	 * @param {Vector3} point - First point of the measurement.
	 */
	constructor(point: Vector3 = new Vector3(0, 0, 0))
	{
		super(new BufferGeometry().setFromPoints([point, point]), new LineBasicMaterial(
			{
				color: 0xffffff,
				linewidth: 5
			}));

		this.points = [point.clone(), point.clone()];

	
		this.text = new Text();
		this.text.fontSize = 0.1;
		this.text.color = 0xFFFFFF;
		this.text.anchorX = "center";
		this.text.anchorY = "middle";
		this.text.rotation.set(Math.PI, Math.PI, Math.PI);
		this.add(this.text);
	}

	/**
	 * Update the second measurement line with new position.
	 *
	 * Useful for preview in real time the measurement.
	 *
	 * @param {Matrix4} matrix - Matrix to extract the position from.
	 */
	setPointFromMatrix(matrix)
	{
		let position = new Vector3(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
		this.points[this.points.length - 1].copy(position);

		this.updateGeometry();
		this.updateText();
	}

	/**
	 * Update the line geometry of the measurement to match the measurements array.
	 *
	 * Also recalculates the bouding sphere of the geometry to ensure proper camera culling.
	 */
	updateGeometry() 
	{
		// @ts-ignore
		let positions = this.geometry.attributes.position.array;
		positions[0] = this.points[0].x;
		positions[1] = this.points[0].y;
		positions[2] = this.points[0].z;

		positions[3] = this.points[1].x;
		positions[4] = this.points[1].y;
		positions[5] = this.points[1].z;

		this.geometry.attributes.position.needsUpdate = true;
		this.geometry.computeBoundingSphere();
	}

	/**
	 * Update the text of the measurement.
	 */
	updateText() 
	{
		let distance = Math.round(this.points[0].distanceTo(this.points[1]) * 100);
		let line = new Line3(this.points[0], this.points[1]);

		line.getCenter(this.text.position);
		this.text.position.y += 0.1;

		this.text.text = distance + " cm";
		this.text.sync();
	}
}
