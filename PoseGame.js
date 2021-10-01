import {DegToRad,Add3,Multiply3,Length3,GetRayRayIntersection3,Clamp01} from './PopEngine/Math.js'
import {CreatePromise,Yield} from './TinyWebgl.js'
import PromiseQueue from './PopEngine/PromiseQueue.js'

class Track_t
{
	constructor()
	{
		this.Points = [
		[0,0],
		[4,0],
		[4,2],
		[3,4],
		[-2,4],
		];
	}
}


const Colours = [
[182, 224, 43],
[237,103,62]
];

const TurnAnglesPerMetre = 150;
const MaxWheelAngle = 45;
const FrictionPerSec = 1.0;
const AccellForce = 0.3;	//	need to turn this into a throttle

class Car_t
{
	constructor(CarIndex)
	{
		this.Colour = Colours[CarIndex%Colours.length].map(f=>f/255);
		this.Position = [0,0,0];
		
		this.BodyAngleDegrees = 0;
		this.WheelAngleDegrees = 0;
		this.Position[0] += CarIndex * 0.5;
		this.Velocity = [0,0,0];
	}
	
	get BodyAngleRadians()
	{
		return DegToRad(this.BodyAngleDegrees);
	}
	get WheelAngleRadians()
	{
		return DegToRad(this.WheelAngleDegrees);
	}
	
	get SpeedNormal()
	{
		let MaxSpeed = 0.1;
		let Speed = Length3(this.Velocity);
		return Speed/MaxSpeed;
	}
	
	Iteration(TimeDelta,InputTurn,InputPower=0)
	{
		
	}
}

export default class Game_t
{
	constructor()
	{
		this.MouseUv = [0.5,0.5];
		this.MouseButtonsDown = {};	//	key=button value=uv
		this.WorldLightPosition = [1.9,1.4,1.8];
		
		this.Event_Finished = CreatePromise();
		
		this.Track = new Track_t();
		this.Cars = [];
		for ( let i=0;	i<33;	i++ )
			this.Cars.push( new Car_t(i) );
			
		this.NewPoseQueue = new PromiseQueue('Poses');
	}
	
	async GameLoop()
	{
		this.Pose = new window.Pose({locateFile: (file) => {
			return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
		}});
		
		this.Pose.setOptions({
			modelComplexity: 0,	//	0,1,2
			smoothLandmarks: true,
			enableSegmentation: false,
			smoothSegmentation: false,
			minDetectionConfidence: 0.3,
			minTrackingConfidence: 0.3
		});
		this.Pose.onResults( Results => this.NewPoseQueue.Push(Results) );
		
		const videoElement = document.getElementsByClassName('input_video')[0];

		const OnCameraFrame = async ()=>
		{
			await this.Pose.send({image: videoElement});
		};
		const CameraOptions = 
		{
			onFrame: OnCameraFrame,
			width:640,
			height:480
		};		
		this.Camera = new window.Camera(videoElement,CameraOptions);
		this.Camera.start();

		while ( this.Pose )
		{
			const Pose = await this.NewPoseQueue.WaitForNext();
			this.UpdatePose(Pose.poseLandmarks);
		}

		await this.Event_Finished;
		return `Game over`;
	}
	
	UpdatePose(Joints)
	{
		if ( !Joints )
			return;
		
		function ConvertXyz(Position)
		{
			//if ( Position.visibility < 0.6 )
			//	return null;
			//	https://google.github.io/mediapipe/solutions/pose.html
			//	x and y: Landmark coordinates normalized to [0.0, 1.0] by the image width and height respectively.
			//	z: Represents the landmark depth with the depth at the midpoint of hips being the origin, and the smaller the value the closer the landmark is to the camera. The magnitude of z uses roughly the same scale as x.
			//	visibility: A value in [0.0, 1.0] indicating the likelihood of the landmark being visible (present and not occluded) in the image.
			let x = Position.x - 0.5;
			let y = 1-Position.y + 0.3;
			let z = -Position.z;
			//z = 0;
			return [x,y,z];
		}
		Joints = Joints.map( ConvertXyz );
		
		//this.Track.Points = Joints;
		
		
		for ( let i=0;	i<Joints.length;	i++ )
		{
			const Car = this.Cars[i];
			if ( !Car )
				continue;
			const xyz = Joints[i];
			Car.Position = xyz;
		}
		//console.log(Pose);
	}
	
	Iteration(TimeDelta,InputRays)
	{
		
	}
	
	GetUniforms()
	{
		const Uniforms = Object.assign({},this);
		Uniforms.CarPositions = this.Cars.map( c => c.Position ).flat();
		Uniforms.CarColours = this.Cars.map( c => c.Colour ).flat();
		Uniforms.CarAngles = this.Cars.map( c => 0 );
		
		Uniforms.TrackPoints = this.Track.Points.flat();
		
		return Uniforms;
	}
}
