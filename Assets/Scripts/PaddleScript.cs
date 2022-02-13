using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PaddleScript : MonoBehaviour
{

    public float speed;

    public float leftScreenEdge;

    public float rightScreenEdge;

    public GameManager gm;

    // Start is called before the first frame update
    void Start()
    {

    }

    // Update is called once per frame
    void Update()
    {
        if (gm.gameOver)
        {
            return;
        }

        float horizontal = Input.GetAxis("Horizontal");

        if (transform.position.x < leftScreenEdge)
        {
            transform.position = new Vector2(leftScreenEdge, transform.position.y);
        }
        else if (transform.position.x > rightScreenEdge)
        {
            transform.position = new Vector2(rightScreenEdge, transform.position.y);
        }
        else
        {
            transform.Translate(Vector2.right * horizontal * Time.deltaTime * speed);
        }

    }

    private void OnTriggerEnter2D(Collider2D collision)
    {
        if (collision.CompareTag("livesPowerUp"))
        {
            gm.UpdateLives(1);
            Destroy(collision.gameObject);
        }
    }
}
