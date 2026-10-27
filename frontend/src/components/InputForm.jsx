
export function InputForm({ label, placeholder, type = "text" }) {
  return (
    <div>
      <p className="">
        {label}
      </p>

      <input type={type} placeholder={placeholder}/>
      
    </div>

  );
}