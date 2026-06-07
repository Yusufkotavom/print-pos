def is_palindrome(s: str) -> bool:
    # Convert the string to lowercase and remove non-alphanumeric characters
    s = "".join(char.lower() for char in s if char.isalnum())

    # Check if the string is equal to its reverse
    return s == s[::-1]
