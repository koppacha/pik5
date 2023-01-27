export default function Record(props) {
    return (
        <li key={props.data.user_id}>a{props.data.user_name}</li>
    )
}